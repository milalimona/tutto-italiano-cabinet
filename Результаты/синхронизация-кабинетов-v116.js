(function(root,factory){
  const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.CabinetRemoteSync=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
  'use strict';

  const STUDENT_SESSION_KEY='tutto-student-session-v116';
  const TEACHER_SESSION_KEY='tutto-teacher-session-v116';

  let activeController=null;

  function createController(options={}){
    const store=options.store,transport=options.transport,role=options.role||'teacher';
    const sessionStorage=options.sessionStorage||globalThis.sessionStorage;
    const intervalMs=Math.max(10000,Number(options.pollInterval)||30000);
    let secret=String(options.secret||''),secretExchanged=false,session={role},timer=null,startPromise=null;
    let current={state:'idle',role,lastSyncAt:null,error:null};
    if(!store?.replaceSnapshot)throw new Error('Локальный кэш не поддерживает серверную гидратацию');
    if(!transport?.request)throw new Error('Транспорт синхронизации недоступен');

    function emit(name,detail={}){if(typeof globalThis.dispatchEvent==='function'&&typeof globalThis.CustomEvent==='function')globalThis.dispatchEvent(new CustomEvent(name,{detail}))}
    function saveSession(){if(!sessionStorage?.setItem||!session.accessToken)return;sessionStorage.setItem(role==='student'?STUDENT_SESSION_KEY:TEACHER_SESSION_KEY,session.accessToken)}
    function restoreSession(){if(session.accessToken||!sessionStorage?.getItem)return;const token=sessionStorage.getItem(role==='student'?STUDENT_SESSION_KEY:TEACHER_SESSION_KEY);if(token)session.accessToken=token}
    function setState(state,error=null){current={...current,state,error:error?{code:error.code||'SYNC_ERROR',message:error.message||String(error)}:null};emit('tutto:sync-status',status())}
    function status(){return JSON.parse(JSON.stringify(current))}

    async function authorize(){
      restoreSession();
      if(role==='teacher'){
        if(options.teacherToken&&!session.accessToken)session.accessToken=String(options.teacherToken);
        if(!session.accessToken){setState('waiting_credentials');return false}
        saveSession();return true;
      }
      if(secret&&!secretExchanged){
        const exchanged=await transport.request('access.exchange',{secret},{});
        if(!exchanged.student?.id)throw new Error('Сервер не вернул идентификатор ученика');
        session={role:'student',accessToken:exchanged.accessToken,studentId:exchanged.student.id,scope:exchanged.scope||[]};
        secretExchanged=true;saveSession();return true;
      }
      if(session.accessToken)return true;
      setState('waiting_credentials');return false;
    }

    async function refresh(){
      if(!await authorize())return null;
      try{
        setState('syncing');
        const snapshot=await transport.request('snapshot.get',{},session);
        if(role==='student'){
          const studentId=session.studentId||snapshot.student?.id;
          const matching=(snapshot.students||[]).filter(item=>item.id===studentId);
          if(!studentId||matching.length!==1||(snapshot.students||[]).some(item=>item.id!==studentId))throw Object.assign(new Error('Сервер вернул данные другого ученика'),{code:'STUDENT_SCOPE_MISMATCH'});
          session.studentId=studentId;
        }
        store.replaceSnapshot(snapshot);
        current.lastSyncAt=new Date().toISOString();
        setState('ready');
        emit('tutto:remote-synced',{revision:snapshot.revision,role});
        return snapshot;
      }catch(error){
        if(error?.status===401&&role==='student'&&secret&&sessionStorage?.removeItem){sessionStorage.removeItem(STUDENT_SESSION_KEY);delete session.accessToken}
        setState('error',error);throw error;
      }
    }

    async function execute(route,payload={}){
      if(!await authorize())throw Object.assign(new Error('Для синхронизации нужен вход'),{code:'SYNC_AUTH_REQUIRED'});
      try{
        const result=await transport.request(route,payload,session);
        await refresh();
        return result;
      }catch(error){
        try{await refresh()}catch(refreshError){}
        throw error;
      }
    }

    function start(){
      if(startPromise)return startPromise;
      startPromise=refresh().then(result=>{
        if(result&&options.poll!==false&&typeof globalThis.setInterval==='function')timer=globalThis.setInterval(()=>{refresh().catch(()=>{})},intervalMs);
        return result;
      }).catch(error=>{startPromise=null;throw error});
      return startPromise;
    }
    function stop(){if(timer&&typeof globalThis.clearInterval==='function')globalThis.clearInterval(timer);timer=null;startPromise=null}
    function setTeacherToken(value){if(role!=='teacher')throw new Error('Токен преподавателя неприменим к кабинету ученика');session.accessToken=String(value||'');saveSession();startPromise=null;return start()}

    function storeFacade(){return{
      getSnapshot:()=>store.getSnapshot(),
      createStudentBundleWithSecretLink:(student,baseUrl)=>execute('student.createBundle',{student,baseUrl}),
      createStudentWithSecretLink:(student,baseUrl)=>execute('student.create',{student,baseUrl}),
    }}

    return{start,stop,refresh,execute,status,setTeacherToken,storeFacade,getSession:()=>({...session})};
  }

  function bootstrap(options={}){
    const baseUrl=String(options.baseUrl||root.TUTTO_API_BASE_URL||'').trim();
    if(!baseUrl)return null;
    if(!root.TrackerApi?.createHttpTransport)throw new Error('HTTP-клиент синхронизации не подключён');
    const store=options.store||root.CabinetDataBridge?.getStore?.();
    const transport=options.transport||root.TrackerApi.createHttpTransport({baseUrl});
    activeController=createController({...options,store,transport});
    activeController.start().catch(error=>{if(root.console?.error)root.console.error('Синхронизация кабинета:',error)});
    return activeController;
  }

  return{STUDENT_SESSION_KEY,TEACHER_SESSION_KEY,createController,bootstrap,getActive:()=>activeController};
});
