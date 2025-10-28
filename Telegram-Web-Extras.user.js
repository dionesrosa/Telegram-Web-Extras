// ==UserScript==
// @name         Telegram Web Extras
// @namespace    https://github.com/dionesrosa
// @version      1.2.3
// @description  Extras para Telegram Web: download de mídia, cores por duração, zoom e melhorias visuais.
// @author       Diones Souza
// @license      MIT
// @icon         https://www.iconfinder.com/icons/3787425/download/png/4096
// @homepageURL  https://github.com/dionesrosa/Telegram-Web-Extras
// @supportURL   https://github.com/dionesrosa/Telegram-Web-Extras/issues
// @updateURL    https://cdn.jsdelivr.net/gh/dionesrosa/Telegram-Web-Extras@master/Telegram-Web-Extras.user.js
// @downloadURL  https://cdn.jsdelivr.net/gh/dionesrosa/Telegram-Web-Extras@master/Telegram-Web-Extras.user.js
// @match        *://web.telegram.org/*
// @run-at       document-idle
// @grant        unsafeWindow
// @grant        GM_addStyle
// @noframes
// ==/UserScript==

(function () {
    'use strict';

    // --- Configurações / variáveis ---
    let midiaAtual = null, idPeerAtual = null;
    let ultimaContagem = 0;
    const classesMidia = ['photo', 'audio', 'video', 'voice-message', 'media-round', 'grouped-item', 'document-container', 'sticker'];

    // --- Helpers ---
    const safeQuery = (sel, root = document) => { try { return root.querySelector(sel); } catch (e) { return null; } };
    const safeQueryAll = (sel, root = document) => { try { return Array.from(root.querySelectorAll(sel)); } catch (e) { return []; } };

    function logWarn(...args) { console.warn('[TG-Extras]', ...args); }

    // --- Função para atualizar o texto do botão ---
    function atualizarTextoBotaoDownload() {
        const batchBtn = document.getElementById('batch-btn');
        if (!batchBtn) return;

        const countElement = document.querySelector('.selection-container-count span');
        if (!countElement) return;

        const texto = countElement.textContent || '';
        const numero = parseInt(texto.match(/\d+/)?.[0] || '0');

        // Só atualizar se a contagem mudou
        if (numero === ultimaContagem) return;
        ultimaContagem = numero;

        let frase_download = "Baixar Mídia"; // Singular
        if (numero > 1) {
            frase_download = "Baixar Mídias"; // Plural
        }

        // Atualizar o texto do botão
        const textoBtn = batchBtn.querySelector('.i18n');
        if (textoBtn) {
            textoBtn.textContent = frase_download;
        }
        batchBtn.title = frase_download;
    }

    // --- Observer específico para o contador de seleção ---
    let observerContador = null;

    function iniciarObserverContador() {
        // Parar observer anterior se existir
        if (observerContador) {
            observerContador.disconnect();
        }

        const countElement = document.querySelector('.selection-container-count');
        if (!countElement) return;

        // Criar observer específico para mudanças no contador
        observerContador = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === 'childList' || mutation.type === 'characterData') {
                    atualizarTextoBotaoDownload();
                    break;
                }
            }
        });

        // Observar mudanças no contador e em seus filhos
        observerContador.observe(countElement, {
            childList: true,
            subtree: true,
            characterData: true
        });
    }

    // --- Função para obter dados da mensagem de forma mais confiável ---
    function obterDadosMidia(elemento) {
        try {
            // Tentar encontrar o elemento mais próximo com data-mid
            const elementoComMid = elemento.closest('[data-mid]');
            if (!elementoComMid) return null;

            // Verificar se é uma mídia
            const isMidia = classesMidia.some(cls =>
                elementoComMid.classList.contains(cls) ||
                elementoComMid.querySelector(`.${cls}`)
            );

            if (!isMidia) return null;

            return {
                mid: elementoComMid.dataset.mid,
                peerId: elementoComMid.dataset.peerId ||
                        elementoComMid.closest('[data-peer-id]')?.dataset.peerId
            };
        } catch (err) {
            return null;
        }
    }

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
                            if (textoBtn) textoBtn.textContent = (segundos + 1) + ' segundos';
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
                            // Restaurar texto baseado na seleção atual
                            atualizarTextoBotaoDownload();
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

    // --- MutationObserver principal ---
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
                        // Verificar se já existe o botão para evitar duplicação
                        if (!document.getElementById('down-btn')) {
                            const htmlBotao = '<div class="btn-menu-item rp-overflow" id="down-btn"><span class="mytgico btn-menu-item-icon" style="font-size: 16px;">💾</span><span class="i18n btn-menu-item-text">Baixar Mídia</span></div>';
                            containerBtn.insertAdjacentHTML('beforebegin', htmlBotao);
                            const downBtn = document.getElementById('down-btn');
                            downBtn?.addEventListener('click', () => {
                                if (idPeerAtual && midiaAtual) {
                                    baixarMidiaUnica(idPeerAtual, midiaAtual);
                                } else {
                                    logWarn('IDs não definidos para download único. Clique com o botão direito diretamente na mídia.');
                                }
                            });
                        }
                    }
                }

                // seleção (barra superior) - inserir botão de batch
                if (el.classList && el.classList.contains('selection-wrapper')) {
                    safeQueryAll('.selection-wrapper').forEach(e => {
                        e.style.setProperty('width', 'auto', 'important');
                    });

                    const left = el.querySelector('.selection-container-left');
                    if (left && !document.getElementById('batch-btn')) {
                        // Criar o botão com texto inicial
                        const htmlBotaoLote = '&nbsp;&nbsp;<button class="btn-primary btn-transparent text-bold" id="batch-btn" title="Baixar Mídia"><span class="mytgico" style="padding-bottom: 2px;">💾</span>&nbsp;<span class="i18n">Baixar Mídia</span></button>';
                        left.insertAdjacentHTML('beforeend', htmlBotaoLote);
                        const b = document.getElementById('batch-btn');
                        b?.addEventListener('click', baixarMidiasSelecionadas);

                        // Iniciar observer específico para o contador
                        setTimeout(() => {
                            iniciarObserverContador();
                            atualizarTextoBotaoDownload(); // Atualizar imediatamente
                        }, 50);
                    }
                }
            }
        }

        // Também verificar se o contador de seleção foi modificado
        for (const mutation of mutations) {
            if (mutation.type === 'childList' || mutation.type === 'characterData') {
                const selectionWrapper = document.querySelector('.selection-wrapper');
                if (selectionWrapper && selectionWrapper.contains(mutation.target)) {
                    setTimeout(atualizarTextoBotaoDownload, 10);
                }
            }
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
    });

    // aplicar css inicial
    window.addEventListener('load', modificarCSS);
    document.addEventListener('readystatechange', () => {
        if (document.readyState === 'complete') modificarCSS();
    });

    // --- Context menu listener melhorado ---
    document.body.addEventListener('contextmenu', function (e) {
        try {
            // Resetar as variáveis
            midiaAtual = null;
            idPeerAtual = null;

            // Tentar obter dados da mídia de forma mais robusta
            const dadosMidia = obterDadosMidia(e.target);
            if (dadosMidia) {
                midiaAtual = dadosMidia.mid;
                idPeerAtual = dadosMidia.peerId;
                console.log('[TG-Extras] Mídia detectada:', { mid: midiaAtual, peerId: idPeerAtual });
            }
        } catch (err) {
            console.warn('[TG-Extras] Erro ao detectar mídia no contextmenu:', err);
        }
    });

    // --- Clique direito alternativo para detectar mídia ---
    document.body.addEventListener('mousedown', function (e) {
        if (e.button === 2) { // Botão direito
            try {
                // Tentar obter dados da mídia de forma mais robusta
                const dadosMidia = obterDadosMidia(e.target);
                if (dadosMidia) {
                    midiaAtual = dadosMidia.mid;
                    idPeerAtual = dadosMidia.peerId;
                }
            } catch (err) {
                // Ignorar erros
            }
        }
    }, { passive: true });

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