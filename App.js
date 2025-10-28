// ==UserScript==
// @name         Telegram Web Extras
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Adiciona funcionalidades extras ao Telegram Web, incluindo a modificação de links e estilos CSS.
// @author       Diones Souza
// @match        *://web.telegram.org/*
// @icon         https://www.iconfinder.com/icons/3787425/download/png/4096
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Função para modificar o CSS da página
    function modificarCSS() {
        document.querySelectorAll('.bubbles-inner').forEach(e => {
            e.style.setProperty('width', '100%', 'important');
            e.style.setProperty('margin-left', '25px', 'important');
        });

        document.querySelectorAll('.video-time').forEach(e => {
            e.style.setProperty('background-color', 'red', 'important');
        });

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


    const observer = new MutationObserver(function (mutations) {
        mutations.forEach(function (mutation) {
            mutation.addedNodes.forEach(function (node) {
                if (node.nodeType !== 1) return; // só elementos

                // 👉 Remove o próprio .is-sponsored se for ele
                if (node.classList.contains('is-sponsored')) {
                    node.remove();
                }

                // 👉 Remove filhos com .is-sponsored
                const patrocinados = node.querySelectorAll?.('.is-sponsored');
                patrocinados?.forEach(el => el.remove());

                modificarCSS();
            });
        });
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    document.addEventListener('DOMContentLoaded', modificarCSS);
})();