const emojiAware = require('emoji-aware');
const modifiers = require('./modifiers');
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
        button.setAttribute('title', emoji.shortname);
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
    write: (emoji, options) => {
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

        // Insert the pictographImage
        const pictographs = input.parentNode.querySelector('.EmojiPanel__pictographs');
        if (pictographs) {
            const url = 'https://abs.twimg.com/emoji/v2/72x72/' + emoji.unicode + '.png';
            const image = document.createElement('img');
            image.classList.add('RichEditor-pictographImage');
            image.setAttribute('src', url);
            image.setAttribute('draggable', false);
            image.dataset.pictographText = emoji.char;
            pictographs.appendChild(image);
        }

        let testImage = '<img src="url" draggable="false">';

        const span = document.createElement('span');
        /*span.classList.add('EmojiPanel__pictographText');
        span.setAttribute('title', emoji.name);
        span.setAttribute('aria-label', emoji.name);
        span.dataset.pictographText = emoji.char;
        span.dataset.pictographImage = url;
        span.innerHTML = '&emsp;';*/

        // Replace each pictograph span with it's native character
        const picts = editable_content.querySelectorAll('.EmojiPanel__pictographText');
        [].forEach.call(picts, pict => {
            //editable_content.replaceChild(document.createTextNode(pict.dataset.pictographText), pict);
        });

        // Split content into array, insert emoji at offset index
        let content = emojiAware.split(editable_content.textContent);
        let inputContent = emojiAware.split(editable_content.textContent);

        console.log(content);

        content.splice(offset, 0, emoji.char);
        content = content.join('');

        

        //div.textContent = content;

        input.value = content;
        editable_content.textContent = content;

        // Trigger a refresh of the input
        const event = document.createEvent('HTMLEvents');
        event.initEvent('mousedown', false, true);
        input.dispatchEvent(event);

        // Update the offset to after the inserted emoji
        editable_content.dataset.offset = parseInt(editable_content.dataset.offset, 10) + 1;
    }
};

module.exports = Emojis;
