(function(root,factory){
  const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.TeacherAccess=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
  'use strict';

  let mounted=null;

  function buildDialog(document){
    const dialog=document.createElement('dialog');
    dialog.id='teacher-access-dialog';
    dialog.className='soft-dialog teacher-access-dialog';
    dialog.innerHTML='<form class="dialog-inner" method="dialog" data-teacher-access-form><div class="dialog-head"><h2>Вход преподавателя</h2></div><p class="dialog-copy">Введите ключ доступа к синхронизированному кабинету. Он сохранится только до закрытия этой вкладки.</p><label class="teacher-access-field">Ключ доступа<input name="teacherToken" type="password" autocomplete="current-password" required></label><p class="dialog-copy teacher-access-error" role="alert" aria-live="polite"></p><div class="dialog-actions"><button class="dialog-button primary" type="submit">Войти</button></div></form>';
    const style=document.createElement('style');
    style.textContent='.teacher-access-dialog{width:min(480px,calc(100% - 28px))}.teacher-access-field{display:grid;gap:7px;color:#928898;font:400 10px Montserrat,"Avenir Next",Inter,Arial,sans-serif}.teacher-access-field input{width:100%;height:42px;padding:0 12px;border:1px solid rgba(121,99,147,.13);border-radius:13px;background:#fff;color:#5f5868;font:400 12px Montserrat,"Avenir Next",Inter,Arial,sans-serif}.teacher-access-error{min-height:16px;margin-bottom:0;color:#a45e78}.teacher-access-dialog[open]::backdrop{background:rgba(75,65,91,.18);backdrop-filter:blur(7px)}';
    document.head.appendChild(style);
    document.body.appendChild(dialog);
    return dialog;
  }

  function mount(controller,{document=root.document}={}){
    if(!controller||!document||controller.getSession?.().role!=='teacher')return null;
    if(mounted)return mounted;
    const dialog=document.querySelector('#teacher-access-dialog')||buildDialog(document);
    const form=dialog.querySelector('[data-teacher-access-form]'),input=form.elements.teacherToken,error=dialog.querySelector('.teacher-access-error'),submit=form.querySelector('[type="submit"]');
    function show(){if(!dialog.open){if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','')}setTimeout(()=>input.focus(),0)}
    function reflect(status=controller.status?.()){if(status?.role!=='teacher')return;if(status.state==='waiting_credentials')show();if(status.state==='ready'&&dialog.open)dialog.close();if(status.state==='error'){error.textContent=status.error?.message||'Не удалось войти';show()}}
    form.addEventListener('submit',async event=>{event.preventDefault();const token=String(input.value||'').trim();if(!token)return;submit.disabled=true;error.textContent='';try{await controller.setTeacherToken(token);input.value='';if(dialog.open)dialog.close();root.dispatchEvent?.(new CustomEvent('tutto:teacher-ready'))}catch(accessError){error.textContent=accessError?.message||'Ключ не принят'}finally{submit.disabled=false}});
    root.addEventListener?.('tutto:sync-status',event=>reflect(event.detail));
    mounted={dialog,show,reflect};
    queueMicrotask(()=>reflect());
    return mounted;
  }

  return{mount};
});
