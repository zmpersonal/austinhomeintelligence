(function(){
  const addressForm = document.querySelector('[data-address-form]');
  if(addressForm){
    addressForm.addEventListener('submit',e=>{
      e.preventDefault();
      const input=addressForm.querySelector('input[name="address"]');
      const address=(input?.value||'').trim();
      const target='whole-home.html'+(address?'?address='+encodeURIComponent(address):'');
      location.href=target;
    });
  }
  document.querySelectorAll('[data-year]').forEach(el=>el.textContent=new Date().getFullYear());
})();
