// ==UserScript==
// @name         Telegram Web Extras
// @namespace    http://tampermonkey.net/
// @version      1.1.0
// @description  Adiciona funcionalidades extras ao Telegram Web, incluindo a modificação de links e estilos CSS.
// @author       Diones Souza
// @match        *://web.telegram.org/*
// @icon         https://www.iconfinder.com/icons/3787425/download/png/4096
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

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

                modificarCSS();
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
})();