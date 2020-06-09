const emojiAware = require('emoji-aware');
const modifiers = require('./modifiers');
import CaretPosition from './create';
import Frequent from './frequent';

let json = null;
const Emojis = {
    load: options => {
        // Load and inject the SVG sprite into the DOM
        let svgPromise = Promise.resolve();
        if(options.pack_url && !document.querySelector(`.${options.classnames.svg}`)) {
            svgPromise = new Promise(resolve => {
                const svgXhr = new XMLHttpRequest();
                svgXhr.open('GET', options.pack_url, true);
                svgXhr.onload = () => {
                    const container = document.createElement('div');
                    container.classList.add(options.classnames.svg);
                    container.style.display = 'none';
                    container.innerHTML = svgXhr.responseText;
                    document.body.appendChild(container);
                    resolve();
                };
                svgXhr.send();
            });
        }

        // Load the emojis json
        if (! json && options.json_save_local) {
            try {
                json = JSON.parse(localStorage.getItem('EmojiPanel-json'));
            } catch (e) {
                json = null;
            }
        }

        let jsonPromise = Promise.resolve(json);
        if(json == null) {
            jsonPromise = new Promise(resolve => {
                const emojiXhr = new XMLHttpRequest();
                emojiXhr.open('GET', options.json_url, true);
                emojiXhr.onreadystatechange = () => {
                    if(emojiXhr.readyState == XMLHttpRequest.DONE && emojiXhr.status == 200) {
                        if (options.json_save_local) {
                            localStorage.setItem('EmojiPanel-json', emojiXhr.responseText);
                        }

                        json = JSON.parse(emojiXhr.responseText);
                        resolve(json);
                    }
                };
                emojiXhr.send();
            });
        }

        return Promise.all([ svgPromise, jsonPromise ]);
    },
    createEl: (emoji, options) => {
        if(options.pack_url) {
            if(document.querySelector(`.${options.classnames.svg} [id="${emoji.unicode}"]`)) {
                return `<svg viewBox="0 0 20 20"><use xlink:href="#${emoji.unicode}"></use></svg>`;
            }
        }
        // Fallback to the emoji char if the pack does not have the sprite, or no pack
        return emoji.char;
    },
    createButton: (emoji, options, emit) => {
        if(emoji.fitzpatrick && options.fitzpatrick) {
            // Remove existing modifiers
            Object.keys(modifiers).forEach(i => emoji.unicode = emoji.unicode.replace(modifiers[i].unicode, ''));
            Object.keys(modifiers).forEach(i => emoji.char = emoji.char.replace(modifiers[i].char, ''));

            // Append fitzpatrick modifier
            emoji.unicode += modifiers[options.fitzpatrick].unicode;
            emoji.char += modifiers[options.fitzpatrick].char;
        }

        const button = document.createElement('button');
        button.setAttribute('type', 'button');
        button.innerHTML = Emojis.createEl(emoji, options);
        button.classList.add('emoji');
        button.dataset.unicode = emoji.unicode;
        button.dataset.char = emoji.char;
        button.dataset.category = emoji.category;
        button.dataset.name = emoji.name;
        if(emoji.fitzpatrick) {
            button.dataset.fitzpatrick = emoji.fitzpatrick;
        }

        if(emit) {
            button.addEventListener('click', () => {
                emit('select', emoji);
                if (options.frequent == true &&
                    Frequent.add(emoji)) {
                    let frequentResults = document.querySelector(`.${options.classnames.frequentResults}`);

                    frequentResults.appendChild(Emojis.createButton(emoji, options, emit));
                    frequentResults.style.display = 'block';
                }

                if(options.editable) {
                    Emojis.write(emoji, options);
                }
            });
        }

        return button;
    },
    updateInput: (options) => {
        const editable_content = options.editable_content;
        const input = options.editable;

        let rawContent = editable_content.cloneNode(true);

        let emojis = rawContent.querySelectorAll('.RichEditor-pictographImage');
        [].forEach.call(emojis,function(emoji){
            let newElem = document.createTextNode(emoji.dataset.emoji);
            emoji.parentNode.replaceChild(newElem,emoji);
        });

        input.value = rawContent.innerText.replace(/&nbsp;/gi, ' ').replace(/<div><br><\/div>/gi, '').replace(/<p><br><\/p>/gi, '').trim();

        //Trigger this events in order to work with Angular 1.6.5
        input.dispatchEvent(new Event('trigger'));
        input.dispatchEvent(new Event('change'));
    },
    updateContentEditable: (options,json) => {
        let newHtml = document.createTextNode(options.editable.value);
        let emojiRegex = ['(?:[\u2700-\u27bf]|(?:\\ud83c[\\udde6-\\uddff]){2}|[\\ud800-\\udbff][\\udc00-\\udfff]|[\u0023-\u0039]\\ufe0f?\u20e3|\u3299|\u3297|\u303d|\u3030|\u24c2|\\ud83c[\\udd70-\\udd71]|\\ud83c[\\udd7e-\\udd7f]|\\ud83c\\udd8e|\\ud83c[\\udd91-\\udd9a]|\\ud83c[\\udde6-\\uddff]|[\\ud83c[\\ude01-\\ude02]|\\ud83c\\ude1a|\\ud83c\\ude2f|[\\ud83c[\\ude32-\\ude3a]|[\\ud83c[\\ude50-\\ude51]|\u203c|\u2049|[\u25aa-\u25ab]|\u25b6|\u25c0|[\u25fb-\u25fe]|\u00a9|\u00ae|\u2122|\u2139|\\ud83c\\udc04|[\u2600-\u26FF]|\u2b05|\u2b06|\u2b07|\u2b1b|\u2b1c|\u2b50|\u2b55|\u231a|\u231b|\u2328|\u23cf|[\u23e9-\u23f3]|[\u23f8-\u23fa]|\\ud83c\\udccf|\u2934|\u2935|[\u2190-\u21ff])']

        options.editable_content.appendChild(newHtml);
        options.editable_content.innerHTML = options.editable_content.innerHTML.replace(
            new RegExp(emojiRegex.join('|'), 'g'),
            '<span class="RichEditor-pictographImage" data-emoji="$&" contenteditable="false">$&</span>');

        Emojis.replaceEmojis(options,json);
    },
    replaceEmojis: (options,json) => {
        let emojis = options.editable_content.querySelectorAll('.RichEditor-pictographImage');

        [].forEach.call(emojis,function(emoji){
            let emojiData = emoji.dataset.emoji;

            json.forEach((category) => {
                for (let key in category.emojis) {
                    if (category.emojis.hasOwnProperty(key)) {
                        let char = category.emojis[key]['char'];
                        let url = 'https://abs.twimg.com/emoji/v2/72x72/' + category.emojis[key]['unicode'] + '.png';

                        if (emojiData === char) {
                            emoji.style.backgroundImage = "url('"+url+"')";
                        }
                    }
                }
            });

        });
    },
    write: (emoji, options, updateInput=false) => {
        const input = options.editable;
        const editable_content = options.editable_content;
        if(!input || !editable_content) {
            return;
        }

        // Insert the emoji at the end of the text by default
        let offset = editable_content.textContent.length;
        if(editable_content.dataset.offset) {
            // Insert the emoji where the rich editor caret was
            offset = editable_content.dataset.offset;
        }

        // Prepare url to be sat as background image on the span in contentEditable element
        const url = 'https://abs.twimg.com/emoji/v2/72x72/' + emoji.unicode + '.png';
        const imgHtml = '<span class="RichEditor-pictographImage" data-emoji="'+emoji.char+'" style="background-image:url('+url+')" contenteditable="false">'+emoji.char+'</span>';

        //Return the focus on the content editable element after it loses due to the click on the emojis panel
        editable_content.focus();

        //Insert the span with the emoji
        Emojis.pasteHtmlAtCaret(imgHtml);

        // Trigger a refresh of the input
        const event = document.createEvent('HTMLEvents');
        event.initEvent('mousedown', false, true);
        input.dispatchEvent(event);
    },
    pasteHtmlAtCaret: (html) => {
        let sel, range;
        if (window.getSelection) {
            // IE9 and non-IE
            sel = window.getSelection();
            if (sel.getRangeAt && sel.rangeCount) {
                range = sel.getRangeAt(0);
                range.deleteContents();

                // Range.createContextualFragment() would be useful here but is
                // only relatively recently standardized and is not supported in
                // some browsers (IE9, for one)
                let el = document.createElement("div");
                el.innerHTML = html;
                let frag = document.createDocumentFragment(), node, lastNode;
                while ( (node = el.firstChild) ) {
                    lastNode = frag.appendChild(node);
                }
                range.insertNode(frag);

                // Preserve the selection
                if (lastNode) {
                    range = range.cloneRange();
                    range.setStartAfter(lastNode);
                    range.collapse(true);
                    sel.removeAllRanges();
                    sel.addRange(range);
                }
            }
        } else if (document.selection && document.selection.type !== "Control") {
            // IE < 9
            document.selection.createRange().pasteHTML(html);
        }
    },
    createTreeWalker : node => {
        return document.createTreeWalker(
            node,
            NodeFilter.SHOW_TEXT,
            { acceptNode: function(node) { return NodeFilter.FILTER_ACCEPT; } },
            false
        );
    },
    getCaretOffsetWithin : node => {
        let range = window.getSelection().getRangeAt(0);

        let treeWalker = document.createTreeWalker(
            node,
            NodeFilter.ELEMENT_NODE,
            function(node) {
                var nodeRange = document.createRange();
                nodeRange.selectNodeContents(node);
                return nodeRange.compareBoundaryPoints(Range.END_TO_END, range) < 1 ?
                    NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
            },
            false
        );

        let charCount = 0, lastNodeLength = 0;

        if (range.startContainer.nodeType == 3) {
            charCount += range.startOffset;
        }

        while (treeWalker.nextNode()) {
            charCount += lastNodeLength;
            lastNodeLength = 0;

            if(range.startContainer != treeWalker.currentNode) {
                if(treeWalker.currentNode instanceof Text) {
                    lastNodeLength += treeWalker.currentNode.length;
                } else if(treeWalker.currentNode instanceof HTMLBRElement ||
                    treeWalker.currentNode instanceof HTMLImageElement /* ||
                      treeWalker.currentNode instanceof HTMLDivElement*/)
                {
                    lastNodeLength++;
                }
            }
        }
        return charCount + lastNodeLength;
    },
    setCaretPositionWithin : (node,index) => {
        var treeWalker = Emojis.createTreeWalker(node);
        var currentPos = 0;

        while(treeWalker.nextNode()) {

            // while we don't reach the node that contains
            // our index we increment `currentPos`
            currentPos += treeWalker.currentNode.length;

            if (currentPos >= index) {

                // offset is relative to the current html element
                // We get the value before reaching the node that goes
                // over the thresold and then calculate the offset
                // within the current node.
                var prevValue = currentPos - treeWalker.currentNode.length;
                var offset = index - prevValue;

                // create a new range that will set the caret
                // at the good position
                var range = document.createRange();
                range.setStart(treeWalker.currentNode, offset);
                range.collapse(true);

                // Update the selection to reflect the range
                // change on the UI
                var sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(range);

                break;
            }
        }
    },
};

module.exports = Emojis;
