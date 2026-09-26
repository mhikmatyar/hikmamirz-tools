/**
 * Registry tools. Setiap tool mendaftarkan dirinya lewat HT.register({...}).
 *
 * Bentuk tool:
 *   id          : string unik, dipakai di URL (#/<id>)
 *   name        : nama yang tampil di sidebar
 *   description : satu kalimat penjelasan
 *   icon        : markup <svg> 20x20
 *   mount(el)   : render tool ke dalam el, boleh return fungsi cleanup
 */
window.HT = {
  tools: [],
  register(tool) {
    this.tools.push(tool);
  },
  find(id) {
    return this.tools.find((t) => t.id === id);
  },
};
