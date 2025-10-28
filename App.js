// ==UserScript==
// @name         Telegram Web Extras
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Adiciona funcionalidades extras ao Telegram Web, incluindo a modificação de links e estilos CSS.
// @author       Diones Souza
// @match        https://web.telegram.org/*
// @grant        none
// @icon https://www.iconfinder.com/icons/3787425/download/ico/4096
// ==/UserScript==

(function() {
    'use strict';

    // Função para modificar os links
    function modificarLinks() {
        console.log('modificarLinks chamada');
        var links = document.querySelectorAll('a');

        links.forEach(function(link) {
            if (link.href.startsWith('https://go.postazap.com/')) {
                var codigo = link.href.split('/').pop();
                var novoLink = 'https://encurtador.postazap.com/' + codigo;
                link.href = novoLink;
                link.textContent = '[MODIFICADO] ' + link.textContent;
            }
        });
    }

    // Função para modificar o CSS da página
    function modificarCSS() {
        // Seleciona todos os elementos correspondentes
        const elementos = document.querySelectorAll('.media-viewer-mover');

        document.querySelectorAll('.media-viewer-movers')[0].style.setProperty('z-index', "99999", 'important');

        // Itera sobre os elementos encontrados
        elementos.forEach((elemento, index) => {
            elemento.style.setProperty('left', "50%", 'important');
            elemento.style.setProperty('top', "50%", 'important');
            elemento.style.setProperty('transform', "scale(1.5) translate3d(-50%, -50%, 0)", 'important');
        });
    }


    // Cria um observador de mutações
    var observer = new MutationObserver(function (mutList) {
        mutList.forEach(function (mut) {
            //console.log('observer chamada');

            mut.addedNodes.forEach(function (anod) {
                if (typeof anod === 'object' && anod.classList && anod.classList.contains('bubbles-inner')) {
                    // Define a largura para 100%
                    anod.style.width = '100%';

                    // Define o max-width para 100%
                    anod.style.maxWidth = '100%';

                    // Define o padding esquerdo e direito para 15px
                    anod.style.paddingLeft = '15px';
                    anod.style.paddingRight = '15px';

                    // Chama a função modificarLinks para ajustar os links da página
                    modificarLinks();
                }

                // Chama a função modificarCSS para ajustar o css
                modificarCSS();
            });
        });
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Ações ao Carregar a Página
    document.addEventListener('DOMContentLoaded', modificarLinks);
    document.addEventListener('DOMContentLoaded', modificarCSS);
})();