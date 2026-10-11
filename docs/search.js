/* Pure search index shared by the offline UI and its regression checks. */
(() => {
  const normalize = s => s.toLowerCase().replace(/ł/g, 'l').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const build = chapters => chapters.map(c => ({...c, haystack: normalize(c.title+' '+c.summary+' '+c.group+' '+c.text)}));
  function find(index, query) {
    const words = normalize(query.trim()).split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    return index.filter(c => words.every(w => c.haystack.includes(w))).map(c => ({c, score:words.reduce((sum,w) => sum+(normalize(c.title).includes(w)?12:0)+(normalize(c.summary).includes(w)?4:0),0)})).sort((a,b) => b.score-a.score);
  }
  window.HmiHelpSearch = {normalize, build, find};
})();
