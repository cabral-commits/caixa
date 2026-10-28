/* App instalado (PWA): a mesma tela do Index.html, falando com a planilha pela implantação "Executar como: Eu"
 * (doPost) em vez de google.script.run. Cada aparelho guarda seu token, obtido com o código de pareamento. */
(function () {
  'use strict';
  const cfg = window.CAIXA_CONFIG || { apps: [] };
  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} }
  };
  const qs = new URLSearchParams(location.search);
  const app = cfg.apps.find(a => a.id === qs.get('app')) || cfg.apps.find(a => a.id === ls.get('caixa.app')) || cfg.apps[0] || null;
  if (app) ls.set('caixa.app', app.id);
  const tokKey = a => 'caixa.token.' + (a || app).id;
  const nameOf = a => ls.get('caixa.nome.' + a.id) || a.name; // nome real da planilha, aprendido ao conectar

  async function post(body, target) {
    let r;
    try { r = await fetch((target || app).api, { method: 'POST', body: JSON.stringify(body), redirect: 'follow' }); } // text/plain: sem preflight de CORS
    catch (e) { throw new Error('NetworkError: sem conexão com a planilha'); }
    if (!r.ok) throw new Error('NetworkError: a planilha respondeu ' + r.status);
    let j; try { j = await r.json(); } catch (e) { throw new Error('NetworkError: resposta inválida da planilha'); }
    if (j.error) throw new Error(j.error);
    return j.result;
  }
  function call(fn, args) {
    if (!app || !app.api) return Promise.reject(new Error('PWA_SEM_CONFIG'));
    const token = ls.get(tokKey());
    if (!token) return Promise.reject(new Error('PAREAR'));
    return post({ token, fn, args }).catch(e => {
      if (/NAO_AUTORIZADO/.test(e.message)) { ls.del(tokKey()); throw new Error('PAREAR'); }
      throw e;
    });
  }
  function runner(ok, fail) {
    return new Proxy({}, {
      get(_, k) {
        if (k === 'withSuccessHandler') return h => runner(h, fail);
        if (k === 'withFailureHandler') return h => runner(ok, h);
        if (k === 'withUserObject') return () => runner(ok, fail);
        return (...args) => { call(k, JSON.parse(JSON.stringify(args))).then(r => ok && ok(r), e => fail && fail(e)); };
      }
    });
  }
  window.google = { script: { run: runner(null, null) } };

  window.CAIXA_PWA = {
    appId: app ? app.id : '',
    appName: app ? nameOf(app) : '',
    apps: cfg.apps,
    connected() { return !!(app && ls.get(tokKey())); },
    /** Tenta o código nesta planilha e, se não for dela, nas outras: conecta na que aceitar (não depende da ordem dos links na configuração). */
    async pair(code) {
      const order = [app].concat(cfg.apps.filter(a => a.id !== app.id));
      let last;
      for (const a of order) {
        try {
          const r = await post({ fn: 'pair', code }, a);
          ls.set(tokKey(a), r.token); ls.set(tokKey(a) + '.nome', r.name); if (r.book) ls.set('caixa.nome.' + a.id, r.book);
          return { name: r.name, book: r.book || a.name, appId: a.id, switched: a.id !== app.id };
        } catch (e) { last = e; if (!/CODIGO_INVALIDO/.test(e.message)) throw e; }
      }
      throw last;
    },
    deviceName() { return app ? ls.get(tokKey() + '.nome') || '' : ''; },
    disconnect() { if (app){ ls.del(tokKey()); ls.del(tokKey() + '.nome'); } },
    others() { return cfg.apps.filter(a => !app || a.id !== app.id).map(a => ({ id: a.id, name: nameOf(a), href: '?app=' + encodeURIComponent(a.id) })); }
  };

  // pede ao navegador para não apagar os dados deste app (token e alterações não enviadas) quando faltar espaço ou por tempo sem uso
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); } catch (e) {}

  if ('serviceWorker' in navigator && !cfg.noServiceWorker) window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
})();
