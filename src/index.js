const { EventEmitter } = require('fbemitter');

const Create = require('./create');
const Emojis = require('./emojis');
const List = require('./list');
const classnames = require('./classnames');

const defaults = {
    search: true,
    frequent: true,
    fitzpatrick: 'a',
    hidden_categories: [],

    pack_url: null,
    json_url: '../emojis.json',
    json_save_local: false,

    tether: true,
    placement: 'bottom',

    locale: {
        add: 'Add emoji',
        brand: 'EmojiPanel',
        frequent: 'Frequently used',
        loading: 'Loading...',
        no_results: 'No results',
        search: 'Search',
        search_results: 'Search results'
    },
    icons: {
        search: '<span class="fa fa-search"></span>'
    },
    classnames
};

export default class EmojiPanel extends EventEmitter {
    constructor(options) {
        super();

        this.options = Object.assign({}, defaults, options);

        const els = ['container', 'trigger', 'editable', 'editable_content'];
        els.forEach(el => {
            if(typeof this.options[el] == 'string') {

                ////////////////////////
                //console.log(this.options[el]);
                ////////////////////////

                this.options[el] = document.querySelector(this.options[el]);
            }
        });

        const create = Create(this.options, this.emit.bind(this), this.toggle.bind(this));
        this.panel = create.panel;
        this.tether = create.tether;

        Emojis.load(this.options)
            .then(res => {
                List(this.options, this.panel, res[1], this.emit.bind(this));
            });
    }

    toggle() {
        const open = this.panel.classList.toggle(this.options.classnames.open);
        const searchInput = this.panel.querySelector('.' + this.options.classnames.searchInput);

        this.emit('toggle', open);
        if(open && this.options.search && searchInput) {
            searchInput.focus();
        }
    }

    reposition() {
        if(this.tether) {
            this.tether.position();
        }
    }

    emojiUnicode (emoji) {
        var comp;
        if (emoji.length === 1) {
            comp = emoji.charCodeAt(0);
        }
        comp = (
            (emoji.charCodeAt(0) - 0xD800) * 0x400
          + (emoji.charCodeAt(1) - 0xDC00) + 0x10000
        );
        if (comp < 0) {
            comp = emoji.charCodeAt(0);
        }
        return comp.toString("16");
    }

    renderContent() {
        //this.toggle();
        let charArray = [...this.options.editable.value];
        charArray.forEach((char) => {
            let emoji = {unicode: this.emojiUnicode(char), char: char};
            const button = document.createElement('button');
            button.setAttribute('type', 'button');
            button.innerHTML = Emojis.createEl(emoji, this.options);
            button.classList.add('emoji');
            button.dataset.unicode = emoji.unicode;
            button.dataset.char = emoji.char;
    
            this.options.editable.appendChild(button);
            this.options.editable_content.appendChild(button);
        });        
    }
}

if(typeof window != 'undefined') {
    window.EmojiPanel = EmojiPanel;
}
