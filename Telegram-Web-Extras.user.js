// ==UserScript==
// @name         Telegram Web Extras
// @namespace    http://tampermonkey.net/
// @version      1.2.1
// @description  Extras para Telegram Web: download, cores por duração, zoom e pequenas melhorias.
// @author       Diones Souza
// @match        *://web.telegram.org/*
// @icon         https://www.iconfinder.com/icons/3787425/download/png/4096
// @grant        unsafeWindow
// @grant        GM_addStyle
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    // --- Configurações / variáveis ---
    let midiaAtual = null, idPeerAtual = null;
    const classesMidia = ['photo', 'audio', 'video', 'voice-message', 'media-round', 'grouped-item', 'document-container', 'sticker'];

    // --- Helpers ---
    const safeQuery = (sel, root = document) => { try { return root.querySelector(sel); } catch (e) { return null; } };
    const safeQueryAll = (sel, root = document) => { try { return Array.from(root.querySelectorAll(sel)); } catch (e) { return []; } };

    function logWarn(...args) { console.warn('[TG-Extras]', ...args); }

    // --- Download de mídia (verifica disponibilidade das APIs internas) ---
    function baixarMidiaDaMensagem(msg) {
        try {
            if (!msg) return logWarn('Mensagem inválida para download');
            const minhaMidia = msg.media?.document ?? msg.media?.photo ?? msg.media;
            if (!minhaMidia) return logWarn('Nenhuma mídia encontrada em msg', msg);

            if (unsafeWindow?.appDownloadManager?.downloadToDisc) {
                unsafeWindow.appDownloadManager.downloadToDisc({ media: minhaMidia });
            } else {
                logWarn('appDownloadManager.downloadToDisc não disponível no contexto (unsafeWindow).');
            }
        } catch (err) {
            console.error('Erro em baixarMidiaDaMensagem', err);
        }
    }

    async function baixarMidiaUnica(pid, mid) {
        try {
            if (!unsafeWindow?.mtprotoMessagePort?.getMessageByPeer) {
                logWarn('mtprotoMessagePort.getMessageByPeer não disponível.');
                return;
            }
            const msg = await unsafeWindow.mtprotoMessagePort.getMessageByPeer(pid, mid);
            baixarMidiaDaMensagem(msg);
        } catch (err) {
            console.error('Erro em baixarMidiaUnica', err);
        }
    }

    // --- Batch download com controle de velocidade ---
    async function baixarMidiasSelecionadas() {
        try {
            const selApi = unsafeWindow?.appImManager?.chat?.selection;
            if (!selApi?.getSelectedMessages) { logWarn('Seleção de mensagens não disponível'); return; }
            const mensagens = await selApi.getSelectedMessages();
            let segundos = 0;

            const elementoBtn = document.getElementById('batch-btn');
            const textoBtn = elementoBtn?.querySelector('.i18n');
            const iconeBtn = elementoBtn?.querySelector('.mytgico');

            // percorrer mensagens
            mensagens.forEach((msg, indice) => {
                if (msg?.media && (msg.media.document || msg.media.photo)) {
                    setTimeout(() => {
                        if (elementoBtn) {
                            elementoBtn.disabled = true;
                            elementoBtn.style.opacity = 0.6;
                            if (textoBtn) textoBtn.textContent = '..' + (segundos + 1) + '..';
                            if (iconeBtn) iconeBtn.textContent = '🕔';
                        }
                        baixarMidiaDaMensagem(msg);
                    }, segundos * 1000);
                    segundos++;
                }

                if (indice === mensagens.length - 1) {
                    setTimeout(() => {
                        if (elementoBtn) {
                            elementoBtn.disabled = false;
                            elementoBtn.style.opacity = 1;
                            if (textoBtn) textoBtn.textContent = 'Baixar';
                            if (iconeBtn) iconeBtn.textContent = '💾';
                        }
                    }, (segundos + 0.2) * 1000);
                }
            });
        } catch (err) {
            console.error('Erro em baixarMidiasSelecionadas', err);
        }
    }

    // --- Cor por duração (robusta) ---
    function parseTempoEmSegundos(tempo) {
        if (!tempo || typeof tempo !== 'string') return 0;
        const partes = tempo.split(':').map(p => parseInt(p, 10));
        if (partes.some(isNaN)) {
            // tentativa de limpar
            const clean = tempo.replace(/[^\d:]/g, '');
            const p2 = clean.split(':').map(x => parseInt(x, 10));
            if (p2.some(isNaN)) return 0;
            return p2.length === 1 ? p2[0] : (p2.length === 2 ? p2[0]*60 + p2[1] : p2[0]*3600 + p2[1]*60 + p2[2]);
        }
        if (partes.length === 1) return partes[0];
        if (partes.length === 2) return partes[0]*60 + partes[1];
        return partes[0]*3600 + partes[1]*60 + (partes[2] || 0);
    }

    function getCorPorDuracao(tempo) {
        const segundos = parseTempoEmSegundos(tempo);
        if (segundos <= 30) return '#4CAF50';
        if (segundos <= 300) return '#2196F3';
        if (segundos <= 900) return '#FF9800';
        if (segundos <= 1800) return '#9C27B0';
        return '#F44336';
    }

    // --- Modificações de estilo e comportamento ---
    function modificarCSS() {
        try {
            // largura e margem
            safeQueryAll('.bubbles-inner').forEach(e => {
                e.style.setProperty('width', '100%', 'important');
                e.style.setProperty('margin-left', '25px', 'important');
            });

            // video-time com cor
            safeQueryAll('.video-time').forEach(e => {
                const tempo = (e.textContent || '').trim();
                const cor = getCorPorDuracao(tempo);
                e.style.setProperty('background-color', cor, 'important');
                e.style.setProperty('color', 'white', 'important');
                e.style.setProperty('font-weight', 'bold', 'important');
                e.style.setProperty('padding', '2px 6px', 'important');
                e.style.setProperty('border-radius', '4px', 'important');
            });

            // media viewer zoom (não forçar transform eterno - só ajustar z-index e permitir efeito)
            safeQueryAll('.media-viewer-whole').forEach(wrapper => {
                safeQueryAll('.media-viewer-movers', wrapper).forEach(el => {
                    el.style.setProperty('z-index', '99999', 'important');
                    // não aplicar transform permanentemente; deixar para onclick/toggle se quiser.
                    el.addEventListener('dblclick', () => {
                        const current = el.style.transform || '';
                        if (current.includes('scale(1.5)')) {
                            el.style.setProperty('transform', 'translate3d(0px, 0px, 0px) scale(1)', 'important');
                        } else {
                            el.style.setProperty('transform', 'translate3d(-341.5px, -175.5px, 0px) scale(1.5)', 'important');
                        }
                    }, { passive: true });
                });
            });
        } catch (err) {
            console.error('Erro em modificarCSS', err);
        }
    }

    // --- MutationObserver (mais seguro) ---
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType !== 1) continue;
                const el = node;

                // remove patrocinados
                try {
                    if (el.classList?.contains('is-sponsored')) el.remove();
                    safeQueryAll('.is-sponsored', el).forEach(s => s.remove());
                } catch (e) {}

                // aplica css/styles
                modificarCSS();

                // menu de contexto da bolha - insere botão "Baixar Mídia"
                if (el.id === 'bubble-contextmenu') {
                    const containerBtn = el.querySelector('.btn-menu-item') || el.querySelector('.menu');
                    if (containerBtn) {
                        const htmlBotao = '<div class="btn-menu-item rp-overflow" id="down-btn"><span class="mytgico btn-menu-item-icon" style="font-size: 16px;">💾</span><span class="i18n btn-menu-item-text">Baixar Mídia</span></div>';
                        containerBtn.insertAdjacentHTML('beforebegin', htmlBotao);
                        const downBtn = document.getElementById('down-btn');
                        downBtn?.addEventListener('click', () => {
                            if (idPeerAtual && midiaAtual) {
                                baixarMidiaUnica(idPeerAtual, midiaAtual);
                            } else {
                                logWarn('IDs não definidos para download único (midiaAtual / idPeerAtual).');
                            }
                        });
                    }
                }

                // seleção (barra superior) - inserir botão de batch
                if (el.classList && el.classList.contains('selection-wrapper')) {
                    const left = el.querySelector('.selection-container-left');
                    if (left && !document.getElementById('batch-btn')) {
                        const htmlBotaoLote = '&nbsp;&nbsp;<button class="btn-primary btn-transparent text-bold" id="batch-btn" title="Baixar Mídia"><span class="mytgico" style="padding-bottom: 2px;">💾</span>&nbsp;<span class="i18n">Baixar Mídia</span></button>';
                        left.insertAdjacentHTML('beforeend', htmlBotaoLote);
                        const b = document.getElementById('batch-btn');
                        b?.addEventListener('click', baixarMidiasSelecionadas);
                    }
                }
            }
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // aplicar css inicial
    window.addEventListener('load', modificarCSS);
    document.addEventListener('readystatechange', () => { if (document.readyState === 'complete') modificarCSS(); });

    // --- Context menu listener para pegar dados da mídia (mais confiável que mouseup) ---
    document.body.addEventListener('contextmenu', function (e) {
        try {
            const elementoProximo = e.target.closest('[data-mid]');
            if (elementoProximo && classesMidia.some(cls => elementoProximo.classList.contains(cls))) {
                midiaAtual = elementoProximo.dataset.mid;
                idPeerAtual = elementoProximo.dataset.peerId;
            }
        } catch (err) { /* ignore */ }
    });

    // --- Habilitar cópia (Ctrl/Cmd+C) de forma segura sem sobrescrever APIs ---
    function enableCopyFallback() {
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
                const sel = window.getSelection?.().toString() || '';
                if (!sel) return;
                // tenta clipboard API, fallback para textarea+execCommand
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(sel).catch(() => {
                        const ta = document.createElement('textarea'); ta.value = sel; document.body.appendChild(ta);
                        ta.select(); document.execCommand('copy'); ta.remove();
                    });
                } else {
                    const ta = document.createElement('textarea'); ta.value = sel; document.body.appendChild(ta);
                    ta.select(); document.execCommand('copy'); ta.remove();
                }
            }
        }, { passive: true });
    }
    enableCopyFallback();

    // --- Forçar seleção de texto via CSS (usando GM_addStyle quando possível) ---
    const css = `
        .no-forwards .bubbles, .bubble, .bubble-content {
            -webkit-user-select: text !important;
            -moz-user-select: text !important;
            user-select: text !important;
        }
    `;
    try {
        if (typeof GM_addStyle === 'function') GM_addStyle(css);
        else {
            const estilo = document.createElement('style');
            estilo.textContent = css;
            document.head.appendChild(estilo);
        }
    } catch (err) {
        console.warn('Não foi possível aplicar GM_addStyle, usando fallback.', err);
        const estilo = document.createElement('style');
        estilo.textContent = css;
        document.head.appendChild(estilo);
    }

    // --- Redirecionamento WebA -> WebK (mantive) ---
    try {
        if (window.location.pathname.startsWith('/a/')) {
            window.location.replace(window.location.href.replace('.org/a/', '.org/k/'));
        }
    } catch (err) { /* ignore */ }

    // --- fim ---
    console.log('[TG-Extras] carregado (revisado).');
})();