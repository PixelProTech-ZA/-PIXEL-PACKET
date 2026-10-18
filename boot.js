/* PIXEL PACKET — boot.js : assemble the course */
(function () {
  'use strict';
  var main = document.getElementById('main');
  PP.mount(main);
  PP.buildRail();
  PP.progress();
  PP.warp();
  PP.hero();
  var st = document.getElementById('hero-stats');
  if (st) {
    st.innerHTML = '<span><b>' + PP.chapters.filter(function (c) { return c.num !== 99; }).length + '</b>chapters</span><span><b>' + PP.labCount + '</b>live labs</span><span><b>' + PP.algoCount + '</b>algorithms shown</span><span><b>0</b>faked numbers</span>';
  }
  document.querySelectorAll('[data-go]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var t = document.getElementById(a.getAttribute('data-go')); if (!t) return;
      e.preventDefault(); t.scrollIntoView({ behavior: PP.reduced ? 'auto' : 'smooth', block: 'start' });
    });
  });
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () { /* offline cache optional */ }); });
  }
})();
