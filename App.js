// ==UserScript==
// @name         Telegram Web Extras
// @namespace    http://tampermonkey.net/
// @version      1.2.0
// @description  Adiciona funcionalidades extras ao Telegram Web, incluindo a modificação de links e estilos CSS.
// @author       Diones Souza
// @match        *://web.telegram.org/*
// @icon         https://www.iconfinder.com/icons/3787425/download/png/4096
// @grant        unsafeWindow
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';

    // Variáveis para download
    let midiaAtual, idPeerAtual;
    const classesMidia = ['photo', 'audio', 'video', 'voice-message', 'media-round', 'grouped-item', 'document-container', 'sticker'];

    // Extrair mídia da mensagem e fazer download
    function baixarMidiaDaMensagem(msg) {
        let minhaMidia;

        if (msg.media) {
            // Extrair o objeto de mídia
            minhaMidia = msg.media.document || msg.media.photo;
        }

        if (minhaMidia) {
            // Fazer download usando função nativa
            unsafeWindow.appDownloadManager.downloadToDisc({media: minhaMidia});
        }
    }

    // Controlar velocidade de download de múltiplas mídias
    function controlarVelocidade(segundos, msg, elementoBtn, textoBtn, iconeBtn) {
        setTimeout(function () {
            elementoBtn.disabled = true;
            elementoBtn.style.opacity = 0.6;
            textoBtn.textContent = '..' + (segundos + 1) + '..';
            iconeBtn.textContent = '🕔';

            baixarMidiaDaMensagem(msg);
        }, segundos * 1000);
    }

    // Obter objeto da mensagem e fazer download
    async function baixarMidiaUnica(pid, mid) {
        // Obter o objeto da mensagem baseado no peer e ID da mensagem
        const msg = await unsafeWindow.mtprotoMessagePort.getMessageByPeer(pid, mid);
        baixarMidiaDaMensagem(msg);
    }

    // Fazer download de múltiplas mídias de mensagens selecionadas
    async function baixarMidiasSelecionadas() {
        const mensagens = await unsafeWindow.appImManager.chat.selection.getSelectedMessages();
        let segundos = 0;

        const elementoBtn = document.querySelector('#batch-btn');
        const textoBtn = elementoBtn.querySelector('.i18n');
        const iconeBtn = elementoBtn.querySelector('.mytgico');

        mensagens.forEach(function (msg, indice) {
            // Apenas processar mensagens com mídia
            if (msg.media && (msg.media.document || msg.media.photo)) {
                controlarVelocidade(segundos, msg, elementoBtn, textoBtn, iconeBtn);
                segundos++;
            }

            // Restaurar o botão após último download
            if (indice === mensagens.length - 1) {
                setTimeout(function () {
                    elementoBtn.disabled = false;
                    elementoBtn.style.opacity = 1;
                    textoBtn.textContent = 'Baixar';
                    iconeBtn.textContent = '💾';
                }, segundos * 1000);
            }
        });
    }

    // Função para determinar cor baseada na duração do vídeo
    function getCorPorDuracao(tempo) {
        // Converter tempo para segundos
        let segundos = 0;
        const partes = tempo.split(':');

        if (partes.length === 1) {
            segundos = parseInt(partes[0]) || 0;
        } else if (partes.length === 2) {
            segundos = parseInt(partes[0]) * 60 + parseInt(partes[1]);
        } else if (partes.length === 3) {
            segundos = parseInt(partes[0]) * 3600 + parseInt(partes[1]) * 60 + parseInt(partes[2]);
        }

        // Definir cores baseadas na duração
        if (segundos <= 30) return '#4CAF50';        // Verde - muito curto - menor que 30 segundos
        if (segundos <= 300) return '#2196F3';       // Azul - curto - entre 30 segundos e 5 minutos
        if (segundos <= 900) return '#FF9800';       // Laranja - médio - entre 5 e 15 minutos
        if (segundos <= 1800) return '#9C27B0';      // Roxo - longo - entre 15 e 30 minutos
        return '#F44336';                            // Vermelho - muito longo - mais que 30 minutos
    }

    // Função para modificar o CSS da página
    function modificarCSS() {
        // Modificar largura e posicionamento dos elementos
        document.querySelectorAll('.bubbles-inner').forEach(e => {
            e.style.setProperty('width', '100%', 'important');
            e.style.setProperty('margin-left', '25px', 'important');
        });

        // Modificar video-time com cores baseadas na duração
        document.querySelectorAll('.video-time').forEach(e => {
            const tempo = e.textContent.trim();
            const cor = getCorPorDuracao(tempo);

            e.style.setProperty('background-color', cor, 'important');
            e.style.setProperty('color', 'white', 'important');
            e.style.setProperty('font-weight', 'bold', 'important');
            e.style.setProperty('padding', '2px 6px', 'important');
            e.style.setProperty('border-radius', '4px', 'important');
        });

        // Aumenta o zoom das mídias ao clicar
        const midiaZoom = document.querySelectorAll('.media-viewer-whole');
        midiaZoom.forEach((elemento, index) => {
            const midia = elemento.querySelectorAll('.media-viewer-movers');
            midia.forEach((elemento, index) => {
                elemento.style.setProperty('z-index', "99999", 'important');

                elemento.style.setProperty('transform', "translate3d(-341.5px, -175.5px, 0px) scale(1.5)", 'important');

                elemento.onclick = () => {
                    elemento.style.setProperty('transform', "translate3d(0px, 0px, 0px) scale(1)", 'important');
                };
            });
        });
    }

    // Observador de mutações para detectar novos elementos adicionados ao DOM
    const observer = new MutationObserver(function (mutations) {
        mutations.forEach(function (mutation) {
            mutation.addedNodes.forEach(function (node) {
                if (node.nodeType !== 1) return; // só elementos

                // Remove o próprio .is-sponsored se for ele
                if (node.classList.contains('is-sponsored')) {
                    node.remove();
                }

                // Remove filhos com .is-sponsored
                const patrocinados = node.querySelectorAll?.('.is-sponsored');
                patrocinados?.forEach(el => el.remove());

                // Aplica modificações de CSS
                modificarCSS();

                // Adiciona botão de download individual no menu de contexto
                if (node.id === 'bubble-contextmenu') {
                    const htmlBotao = '<div class="btn-menu-item rp-overflow" id="down-btn"><span class="mytgico btn-menu-item-icon" style="font-size: 16px;">💾</span><span class="i18n btn-menu-item-text">Baixar Mídia</span></div>';

                    node.querySelector('.btn-menu-item').insertAdjacentHTML('beforebegin', htmlBotao);
                    node.querySelector('#down-btn').addEventListener('click', function () {
                        baixarMidiaUnica(idPeerAtual, midiaAtual);
                    });
                }

                // Adiciona botão de download em lote
                if (node.classList && node.classList.contains('selection-wrapper')) {
                    const htmlBotaoLote = '&nbsp;&nbsp;<button class="btn-primary btn-transparent text-bold" id="batch-btn" title="Baixar Mídia"><span class="mytgico" style="padding-bottom: 2px;">💾</span>&nbsp;<span class="i18n">Baixar Mídia</span></button>';

                    node.querySelector('.selection-container-left').insertAdjacentHTML('beforeend', htmlBotaoLote);
                    node.querySelector('#batch-btn').addEventListener('click', function () {
                        baixarMidiasSelecionadas();
                    });
                }
            });
        });
    });

    // Iniciar o observador
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // Modificar CSS ao carregar a página
    document.addEventListener('DOMContentLoaded', modificarCSS);

    // Configurar evento de clique direito para download
    const colunaCentral = document.querySelector('#column-center');

    colunaCentral.addEventListener('mouseup', function (e) {
        // Escutar cliques do botão direito
        if (e.button === 2) {
            // Verificar se o chat atual tem conteúdo restrito
            if (document.querySelector('.no-forwards')) {
                // Encontrar o elemento mais próximo contendo IDs da mensagem
                const elementoProximo = e.target.closest('[data-mid]');
                if (elementoProximo) {
                    // Verificar se o elemento contém classes de mídia
                    if (classesMidia.some(function (nomeClasse) {
                        return elementoProximo.classList.contains(nomeClasse);
                    })) {
                        midiaAtual = elementoProximo.dataset.mid;
                        idPeerAtual = elementoProximo.dataset.peerId;
                    }
                }
            }
        }
    });

    // Redirecionar da versão WebA para WebK
    if (window.location.pathname.startsWith('/a/')) {
        window.location.replace(window.location.href.replace('.org/a/', '.org/k/'));
    }

    // Adicionar CSS para permitir seleção de texto em chats restritos
    const estilo = document.createElement('style');
    estilo.textContent = `
        .no-forwards .bubbles, .bubble, .bubble-content {
            -webkit-user-select: text!important;
            -moz-user-select: text!important;
            user-select: text!important;
        }
    `;
    document.head.appendChild(estilo);

    // Desbloquear Ctrl+C para copiar texto selecionado
    const listenerOriginal = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function(tipo) {
        if (tipo !== 'copy') {
            listenerOriginal.apply(this, arguments);
        }
    };
})();