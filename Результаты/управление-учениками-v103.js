(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.StudentManager=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  async function createStudentBundle({store,baseUrl,student}){
    if(!store?.createStudentBundleWithSecretLink)throw new Error('Общая модель учеников недоступна');
    return store.createStudentBundleWithSecretLink(student,baseUrl);
  }

  function mountNewStudentDialog({store,button,dialog,baseUrl,onCreated}){
    if(!button||!dialog)return null;
    const form=dialog.querySelector('#new-student-form'),result=dialog.querySelector('#new-student-result'),error=dialog.querySelector('#new-student-error'),link=dialog.querySelector('#new-student-secret-link'),submit=form.querySelector('[type="submit"]'),copy=dialog.querySelector('#copy-new-student-link');
    function open(){form.reset();form.querySelector('[name="startDate"]').value=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow'}).format(new Date());result.hidden=true;error.textContent='';dialog.showModal()}
    function close(){dialog.close()}
    button.addEventListener('click',open);
    dialog.querySelector('[data-close-new-student]').addEventListener('click',close);
    dialog.addEventListener('click',event=>{if(event.target===dialog)close()});
    form.addEventListener('submit',async event=>{event.preventDefault();error.textContent='';submit.disabled=true;const data=new FormData(form);try{const created=await createStudentBundle({store,baseUrl,student:{displayName:String(data.get('displayName')||'').trim(),startDate:String(data.get('startDate')||''),level:String(data.get('level')||'A0'),totalLessons:Number(data.get('totalLessons'))||5,price:Number(data.get('price'))||0,lessonPrice:Number(data.get('lessonPrice'))||0,paid:data.get('paid')==='on'}});link.value=created.secretLink;result.hidden=false;if(typeof onCreated==='function')onCreated(created)}catch(reason){error.textContent=reason?.message||'Не удалось добавить ученика'}finally{submit.disabled=false}});
    copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(link.value);copy.textContent='Скопировано'}catch(reason){link.select()}});
    return{open,close};
  }

  return{createStudentBundle,mountNewStudentDialog};
});
