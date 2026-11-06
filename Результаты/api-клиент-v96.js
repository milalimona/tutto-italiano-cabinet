(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.TrackerApi=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  function accessError(message='Недостаточно прав'){const error=new Error(message);error.code='ACCESS_DENIED';return error}

  function createLocalTransport(store){
    if(!store)throw new Error('Нужна каноническая модель данных');
    function requireTeacher(session){if(session?.role!=='teacher')throw accessError()}
    function authorizeLesson(session,lessonId,permission){if(session?.role==='teacher')return;const snapshot=store.getSnapshot(),lesson=snapshot.lessons.find(item=>item.id===lessonId);if(session?.role!=='student'||!lesson||lesson.studentId!==session.studentId||!session.scope?.includes(permission))throw accessError()}
    return{
      async request(route,payload={},session={}){
        switch(route){
          case 'snapshot.get':
            return session.role==='teacher'?store.getSnapshot():store.getStudentSnapshot(session.studentId,{includePrivate:false});
          case 'student.create':
            requireTeacher(session);return store.createStudentWithSecretLink(payload.student,payload.baseUrl);
          case 'student.createBundle':
            requireTeacher(session);return store.createStudentBundleWithSecretLink(payload.student,payload.baseUrl);
          case 'student.update':
            requireTeacher(session);return store.updateStudentProfile(payload.studentId,payload);
          case 'student.schedule.save':
            requireTeacher(session);return store.saveStudentSchedule(payload.studentId,payload);
          case 'lesson.create':
            requireTeacher(session);return store.createLesson(payload);
          case 'lesson.reschedule':
            authorizeLesson(session,payload.lessonId,'lesson:reschedule');return store.rescheduleLesson(payload.lessonId,payload.newStartsAt,payload.expectedVersion,session.role);
          case 'lesson.complete':
            authorizeLesson(session,payload.lessonId,'lesson:complete');return store.completeLesson(payload.lessonId,payload.expectedVersion,session.role);
          case 'lesson.cancel':
            authorizeLesson(session,payload.lessonId,'lesson:cancel');return store.cancelLesson(payload.lessonId,payload.expectedVersion,payload.reason,session.role);
          case 'lesson.reopen':
            requireTeacher(session);return store.reopenLesson(payload.lessonId,payload.expectedVersion,session.role);
          case 'subscription.create':
            requireTeacher(session);return store.createSubscription(payload);
          case 'subscription.save':
            requireTeacher(session);return store.saveSubscription(payload);
          case 'payment.save':
            requireTeacher(session);return store.savePayment(payload);
          case 'serviceSubscription.save':
            requireTeacher(session);return store.saveServiceSubscription(payload);
          case 'serviceSubscription.confirmCharge':
            requireTeacher(session);return store.confirmServiceSubscriptionCharge(payload);
          case 'serviceSubscription.stop':
            requireTeacher(session);return store.stopServiceSubscription(payload);
          case 'note.save':
            requireTeacher(session);return store.saveNote({...payload,author:'teacher'});
          default:
            throw new Error(`Неизвестная операция API: ${route}`);
        }
      }
    }
  }

  function createHttpTransport({baseUrl,fetchImpl=globalThis.fetch}={}){
    const endpoint=String(baseUrl||'').replace(/\/+$/,'');
    if(!endpoint)throw new Error('Не указан адрес API');
    if(typeof fetchImpl!=='function')throw new Error('HTTP-транспорт недоступен');
    function requestId(){return globalThis.crypto?.randomUUID?.()||`request-${Date.now()}-${Math.random().toString(16).slice(2)}`}
    return{
      async request(route,payload={},session={}){
        const id=requestId(),headers={'Content-Type':'application/json','X-Request-ID':id},accessToken=session?.accessToken||session?.token||'';
        if(accessToken)headers['X-Tracker-Token']=accessToken;
        const response=await fetchImpl(`${endpoint}/v1/operations`,{
          method:'POST',headers,cache:'no-store',body:JSON.stringify({route,payload,requestId:id}),
        });
        let body=null;
        try{body=await response.json()}catch(error){body=null}
        if(!response.ok||!body?.ok){
          const apiError=new Error(body?.error?.message||`API вернул HTTP ${response.status}`);
          apiError.code=body?.error?.code||'HTTP_ERROR';
          apiError.details=body?.error?.details||{};
          apiError.status=response.status;
          throw apiError;
        }
        return body.data;
      }
    }
  }

  function createClient({transport,session}){
    if(!transport?.request)throw new Error('Транспорт API недоступен');
    const call=(route,payload)=>transport.request(route,payload,session);
    return{
      exchangeAccess:secret=>call('access.exchange',{secret}),
      getSnapshot:()=>call('snapshot.get',{}),
      createStudent:(student,baseUrl)=>call('student.create',{student,baseUrl}),
      createStudentBundle:(student,baseUrl)=>call('student.createBundle',{student,baseUrl}),
      updateStudent:(studentId,changes)=>call('student.update',{studentId,...changes}),
      saveStudentSchedule:(studentId,changes)=>call('student.schedule.save',{studentId,...changes}),
      createLesson:lesson=>call('lesson.create',lesson),
      rescheduleLesson:(lessonId,newStartsAt,expectedVersion)=>call('lesson.reschedule',{lessonId,newStartsAt,expectedVersion}),
      completeLesson:(lessonId,expectedVersion)=>call('lesson.complete',{lessonId,expectedVersion}),
      cancelLesson:(lessonId,expectedVersion,reason='')=>call('lesson.cancel',{lessonId,expectedVersion,reason}),
      reopenLesson:(lessonId,expectedVersion)=>call('lesson.reopen',{lessonId,expectedVersion}),
      createSubscription:subscription=>call('subscription.create',subscription),
      saveSubscription:subscription=>call('subscription.save',subscription),
      savePayment:payment=>call('payment.save',payment),
      saveServiceSubscription:subscription=>call('serviceSubscription.save',subscription),
      confirmServiceSubscriptionCharge:confirmation=>call('serviceSubscription.confirmCharge',confirmation),
      stopServiceSubscription:subscription=>call('serviceSubscription.stop',subscription),
      saveNote:note=>call('note.save',note)
    }
  }

  async function createStudentSession(store,rawToken){const resolved=await store.resolveSecretLink(rawToken);return{role:'student',studentId:resolved.student.id,scope:resolved.scope,tokenId:resolved.tokenId}}

  return{createLocalTransport,createHttpTransport,createClient,createStudentSession};
});
