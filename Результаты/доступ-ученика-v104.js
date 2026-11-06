(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.SecretStudentAccess=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  function accessError(code,message){const error=new Error(message);error.code=code;return error}
  function extractAccessToken(hash){
    const value=String(hash||'').replace(/^#/,'');
    const token=new URLSearchParams(value).get('access');
    return token?decodeURIComponent(token):'';
  }
  function profileFromStudent(student){
    const profile=student?.profile?.compatibility||{};
    return{
      startedAt:profile.startedAt||student?.startDate||'',level:profile.level||'A0',paid:profile.paid===true,
      allTimeLessons:Number(profile.allTimeLessons)||0,lessonPrice:Number(profile.lessonPrice)||0,
      passPrice:Number(profile.passPrice)||0,cancelledDates:Array.isArray(profile.cancelledDates)?profile.cancelledDates:[],
      contacts:{phone:'',messenger:'',email:'',timezone:'Москва · UTC+3',...(profile.contacts||{})},
      schedule:Array.isArray(profile.schedule)?profile.schedule:[4],scheduleTimes:profile.scheduleTimes||{4:'16:00'},
      lessonReschedules:Array.isArray(profile.lessonReschedules)?profile.lessonReschedules:[],lessonTimeOverrides:profile.lessonTimeOverrides||{},
      totalLessons:Math.max(1,Number(profile.totalLessons)||5),completedCount:Number(profile.completedCount)||0,
      completedDates:Array.isArray(profile.completedDates)?profile.completedDates:[],levelStats:profile.levelStats||{[profile.level||'A0']:0},
      subscriptionHistory:Array.isArray(profile.subscriptionHistory)?profile.subscriptionHistory:[]
    };
  }
  async function resolveStudentAccess({store,hash}){
    const token=extractAccessToken(hash);
    if(!token)throw accessError('ACCESS_MISSING','В ссылке нет кода доступа');
    const remote=globalThis.CabinetRemoteSync?.getActive?.();
    if(remote){
      await remote.start();
      const studentId=remote.getSession().studentId;
      const matches=(store?.getSnapshot?.().students||[]).filter(student=>student.id===studentId);
      if(matches.length!==1)throw accessError('ACCESS_DENIED','Ученик недоступен');
      return{student:matches[0],scope:remote.getSession().scope||[],profile:profileFromStudent(matches[0]),studentView:true};
    }
    if(!store?.resolveSecretLink)throw accessError('STORE_UNAVAILABLE','Хранилище кабинета недоступно');
    const resolved=await store.resolveSecretLink(token);
    return{...resolved,profile:profileFromStudent(resolved.student),studentView:true};
  }

  return{extractAccessToken,profileFromStudent,resolveStudentAccess};
});
