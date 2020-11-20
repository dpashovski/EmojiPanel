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
        input.value = rawContent.innerText.replace(/&nbsp;/gi, ' ').replace(/<div><br><\/div>/gi, '').replace(/<p><br><\/p>/gi, '').trim();

        //Trigger this events in order to work with Angular 1.6.5
        input.dispatchEvent(new Event('trigger'));
        input.dispatchEvent(new Event('change'));
    },
    updateContentEditable: (options,json) => {
        let newHtml = document.createTextNode(options.editable.value);
        options.editable_content.appendChild(newHtml);
    },
    write: (emoji, options, updateInput=false) => {
        const input = options.editable;
        const editable_content = options.editable_content;

        if(!input || !editable_content) { return; }

        // Insert the emoji at the end of the text by default
        let offset = editable_content.textContent.length;
        if(editable_content.dataset.offset) {
            // Insert the emoji where the rich editor caret was
            offset = editable_content.dataset.offset;
        }

        //Return the focus on the content editable element after it loses due to the click on the emojis panel
        Emojis.setCaretPositionWithin(editable_content,offset);

        //Insert the span with the emoji
        Emojis.pasteHtmlAtCaret(emoji.char);

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
