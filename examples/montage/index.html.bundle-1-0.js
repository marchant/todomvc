montageDefine("604e6eb","composer/press-composer",{dependencies:["../core/core","./composer","../core/event/mutable-event"],factory:function(require,exports,module){/*global require, exports*/

/**
 * @module montage/composer/press-composer
 * @requires montage/core/core
 * @requires montage/composer/composer
 * @requires montage/core/event/mutable-event
 */
var Montage = require("../core/core").Montage,
    Composer = require("./composer").Composer,
    MutableEvent = require("../core/event/mutable-event").MutableEvent;

/**
 * @class PressComposer
 * @classdesc The `PressComposer` abstracts away handling mouse and touch
 * events that represent presses, allowing generic detection of presses, long
 * presses, and cancelled presses.
 *
 * @extends Composer
 * @fires pressStart
 * @fires press
 * @fires longPress
 * @fires pressCancel
 */
var PressComposer = exports.PressComposer = Composer.specialize(/** @lends PressComposer.prototype # */ {

    /**
     * Dispatched when a press begins. It is ended by either a {@link press} or
     * {@link pressCancel} event.
     *
     * @event pressStart
     * @memberof PressComposer
     * @param {PressEvent} event
     */

    /**
     * Dispatched when a press is complete.
     *
     * @event press
     * @memberof PressComposer
     * @param {PressEvent} event
     */

    /**
     * Dispatched when a press lasts for longer than (@link longPressThreshold}
     * On a long press, the sequence of events will be:
     * - pressStart: as soon as the composer recognizes it is a press.
     * - longPress: `longPressThreshold` after the pressStart, if the press has
     *   not yet ended.
     * - press: when the press ends, if it isn't cancelled.
     *
     * Handlers of the `longPress` event can call `cancelPress` to prevent
     * `press` being triggered.
     *
     * @event longPress
     * @memberof PressComposer
     * @param {PressEvent} event
     */

    /**
     * Dispatched when a press is canceled. This could be because the pointer
     * left the element, was claimed by another component or maybe a phone call
     * came in.
     *
     * @event pressCancel
     * @memberof PressComposer
     * @param {PressEvent} event
     */

    // Load/unload

    load: {
        value: function () {
            if (window.Touch) {
                this._element.addEventListener("touchstart", this, true);
            } else {
                this._element.addEventListener("mousedown", this, true);
            }
        }
    },

    unload: {
        value: function () {
            if (window.Touch) {
                this._element.removeEventListener("touchstart", this, true);
            } else {
                this._element.removeEventListener("mousedown", this, true);
            }
        }
    },

    /**
     * Delegate that implements `surrenderPointer`. See Component for
     * explanation of what this method should do.
     *
     * @type {Object}
     * @default null
     */
    delegate: {
        value: null
    },


    /**
     * Cancel the current press.
     *
     * Can be used in a "longPress" event handler to prevent the "press" event
     * being fired.
     * @returns boolean true if a press was canceled, false if the composer was
     * already in a unpressed or canceled state.
     */
    cancelPress: {
        value: function () {
            if (this._state === PressComposer.PRESSED) {
                this._dispatchPressCancel();
                this._endInteraction();
                return true;
            }
            return false;
        }
    },

    // Optimisation so that we don't set a timeout if we do not need to
    addEventListener: {
        value: function (type, listener, useCapture) {
            Composer.addEventListener.call(this, type, listener, useCapture);
            if (type === "longPress") {
                this._shouldDispatchLongPress = true;
            }
        }
    },

    UNPRESSED: {
        value: 0
    },
    PRESSED: {
        value: 1
    },
    CANCELLED: {
        value: 2
    },

    _state: {
        enumerable: false,
        value: 0
    },
    state: {
        get: function () {
            return this._state;
        }
    },

    _shouldDispatchLongPress: {
        enumerable: false,
        value: false
    },

    _longPressThreshold: {
        enumerable: false,
        value: 1000
    },
    /**
     * How long a press has to last (in milliseconds) for a longPress event to
     * be dispatched
     * @type number
     */
    longPressThreshold: {
        get: function () {
            return this._longPressThreshold;
        },
        set: function (value) {
            if (this._longPressThreshold !== value) {
                this._longPressThreshold = value;
            }
        }
    },

    _longPressTimeout: {
        enumberable: false,
        value: null
    },

    // Magic

    _observedPointer: {
        enumerable: false,
        value: null
    },

    // TODO: maybe this should be split and moved into handleTouchstart
    // and handleMousedown
    _startInteraction: {
        enumerable: false,
        value: function (event) {
            if (
                ("enabled" in this.component && !this.component.enabled) ||
                this._observedPointer !== null
            ) {
                return false;
            }

            var i = 0, changedTouchCount;

            if (event.type === "touchstart") {

                changedTouchCount = event.changedTouches.length;
                if (changedTouchCount === 1) {
                    this._observedPointer = event.changedTouches[0].identifier;
                }

                document.addEventListener("touchend", this, false);
                document.addEventListener("touchcancel", this, false);
            } else if (event.type === "mousedown") {
                this._observedPointer = "mouse";
                // Needed to cancel the press if mouseup'd when not on the
                // component
                document.addEventListener("mouseup", this, false);
                // Needed to preventDefault if another component has claimed
                // the pointer
                document.addEventListener("click", this, false);
            }

            // Needed to cancel the press because once a drag is started
            // no mouse events are fired
            // http://www.whatwg.org/specs/web-apps/current-work/multipage/dnd.html#initiate-the-drag-and-drop-operation
            this._element.addEventListener("dragstart", this, false);

            this.component.eventManager.claimPointer(this._observedPointer, this);

            this._dispatchPressStart(event);
        }
    },

    /**
     * Decides what should be done based on an interaction.
     *
     * @param {Event} event The event that caused this to be called.
     * @private
     */
    _interpretInteraction: {
        value: function (event) {
            // TODO maybe the code should be moved out to handleClick and
            // handleMouseup
            var isSurrendered, target, isTarget;

            if (this._observedPointer === null) {
                this._endInteraction(event);
                return;
            }

            isSurrendered = !this.component.eventManager.isPointerClaimedByComponent(this._observedPointer, this);
            target = event.target;
            while (target !== this._element && target && target.parentNode) {
                target = target.parentNode;
            }
            isTarget = target === this._element;

            if (isSurrendered && event.type === "click") {
                // Pointer surrendered, so prevent the default action
                event.preventDefault();
                // No need to dispatch an event as pressCancel was dispatched
                // in surrenderPointer, just end the interaction.
                this._endInteraction(event);
                return;
            } else if (event.type === "mouseup") {

                if (!isSurrendered && isTarget) {
                    this._dispatchPress(event);
                    this._endInteraction(event);
                    return;
                } else if (!isSurrendered && !isTarget) {
                    this._dispatchPressCancel(event);
                    this._endInteraction(event);
                    return;
                } else {
                    this._endInteraction(event);
                }
            }
        }
    },

    /**
     * Remove event listeners after an interaction has finished.
     * @private
     */
    _endInteraction: {
        value: function (event) {
            document.removeEventListener("touchend", this);
            document.removeEventListener("touchcancel", this);
            document.removeEventListener("click", this);
            document.removeEventListener("mouseup", this);

            if (this.component.eventManager.isPointerClaimedByComponent(this._observedPointer, this)) {
                this.component.eventManager.forfeitPointer(this._observedPointer, this);
            }
            this._observedPointer = null;
            this._state = PressComposer.UNPRESSED;
        }
    },

    /**
     * Checks if we are observing one of the changed touches. Returns the index
     * of the changed touch if one matches, otherwise returns false. Make sure
     * to check against `!== false` or `=== false` as the
     * matching index might be 0.
     *
     * @function
     * @returns {number|boolean} The index of the matching touch, or false
     * @private
     */
    _changedTouchisObserved: {
        value: function (changedTouches) {
            if (this._observedPointer === null) {
                return false;
            }

            var i = 0, changedTouchCount = changedTouches.length;

            for (; i < changedTouchCount; i++) {
                if (changedTouches[i].identifier === this._observedPointer) {
                    return i;
                }
            }
            return false;
        }
    },

    // Surrender pointer

    surrenderPointer: {
        value: function (pointer, component) {
            var shouldSurrender = this.callDelegateMethod("surrenderPointer", pointer, component);
            if (typeof shouldSurrender !== "undefined" && shouldSurrender === false) {
                return false;
            }

            this._dispatchPressCancel();
            return true;
        }
    },

    // Handlers

    captureTouchstart: {
        value: function (event) {
            this._startInteraction(event);
        }
    },
    handleTouchend: {
        value: function (event) {
            if (this._observedPointer === null) {
                this._endInteraction(event);
                return;
            }

            if (this._changedTouchisObserved(event.changedTouches) !== false) {
                if (this.component.eventManager.isPointerClaimedByComponent(this._observedPointer, this)) {
                    this._dispatchPress(event);
                } else {
                    event.preventDefault();
                }
                this._endInteraction(event);
            }
        }
    },
    handleTouchcancel: {
        value: function (event) {
            if (this._observedPointer === null || this._changedTouchisObserved(event.changedTouches) !== false) {
                if (this.component.eventManager.isPointerClaimedByComponent(this._observedPointer, this)) {
                    this._dispatchPressCancel(event);
                }
                this._endInteraction(event);
            }
        }
    },

    captureMousedown: {
        value: function (event) {
            this._startInteraction(event);
        }
    },
    handleClick: {
        value: function (event) {
            this._interpretInteraction(event);
        }
    },
    handleMouseup: {
        value: function (event) {
            this._interpretInteraction(event);
        }
    },
    handleDragstart: {
        value: function (event) {
            this._dispatchPressCancel(event);
            this._endInteraction();
        }
    },

    // Event dispatch

    _createPressEvent: {
        enumerable: false,
        value: function (name, event) {
            var pressEvent, detail, index;

            if (!event) {
                event = document.createEvent("CustomEvent");
                event.initCustomEvent(name, true, true, null);
            }

            pressEvent = new PressEvent();
            pressEvent.event = event;
            pressEvent.type = name;
            pressEvent.pointer = this._observedPointer;
            pressEvent.targetElement = event.target;

            if (event.changedTouches &&
                (index = this._changedTouchisObserved(event.changedTouches)) !== false
            ) {
                pressEvent.touch = event.changedTouches[index];
            }

            return pressEvent;
        }
    },

    _dispatchPressStart: {
        enumerable: false,
        value: function (event) {
            this._state = PressComposer.PRESSED;
            this.dispatchEvent(this._createPressEvent("pressStart", event));

            if (this._shouldDispatchLongPress) {
                var self = this;
                this._longPressTimeout = setTimeout(function () {
                    self._dispatchLongPress();
                }, this._longPressThreshold);
            }
        }
    },

    _dispatchPress: {
        enumerable: false,
        value: function (event) {
            if (this._shouldDispatchLongPress) {
                clearTimeout(this._longPressTimeout);
                this._longPressTimeout = null;
            }

            this.dispatchEvent(this._createPressEvent("press", event));
            this._state = PressComposer.UNPRESSED;
        }
    },

    _dispatchLongPress: {
        enumerable: false,
        value: function (event) {
            if (this._shouldDispatchLongPress) {
                this.dispatchEvent(this._createPressEvent("longPress", event));
                this._longPressTimeout = null;
            }
        }
    },

    _dispatchPressCancel: {
        enumerable: false,
        value: function (event) {
            if (this._shouldDispatchLongPress) {
                clearTimeout(this._longPressTimeout);
                this._longPressTimeout = null;
            }

            this._state = PressComposer.CANCELLED;
            this.dispatchEvent(this._createPressEvent("pressCancel", event));
        }
    }

});

/*
 * @class PressEvent
 * @inherits MutableEvent
 * @classdesc The event dispatched by the `PressComposer`, providing access to
 * the raw DOM event and proxying its properties.
 */
var PressEvent = (function (){
    var value, eventProps, typeProps, eventPropDescriptor, typePropDescriptor, i;

    value = MutableEvent.specialize({
        type: {
            value: "press"
        },
        _event: {
            enumerable: false,
            value: null
        },
        event: {
            get: function () {
                return this._event;
            },
            set: function (value) {
                this._event = value;
            }
        },
        _touch: {
            enumerable: false,
            value: null
        },
        touch: {
            get: function () {
                return this._touch;
            },
            set: function (value) {
                this._touch = value;
            }
        }
    });

    // These properties are available directly on the event
    eventProps = ["altKey", "ctrlKey", "metaKey", "shiftKey",
    "cancelBubble", "currentTarget", "defaultPrevented",
    "eventPhase", "timeStamp", "preventDefault",
    "stopImmediatePropagation", "stopPropagation"];
    // These properties are available on the event in the case of mouse, and
    // on the _touch in the case of touch
    typeProps = ["clientX", "clientY", "pageX", "pageY", "screenX", "screenY", "target"];

    eventPropDescriptor = function (prop) {
        return {
            get: function () {
                return this._event[prop];
            }
        };
    };
    typePropDescriptor = function (prop) {
        return {
            get: function () {
                return (this._touch) ? this._touch[prop] : this._event[prop];
            }
        };
    };

    for (i = eventProps.length - 1; i >= 0; i--) {
        Montage.defineProperty(value, eventProps[i], eventPropDescriptor(eventProps[i]));
    }
    for (i = typeProps.length - 1; i >= 0; i--) {
        Montage.defineProperty(value, typeProps[i], typePropDescriptor(typeProps[i]));
    }

    return value;
}());

}})
;
//*/
montageDefine("bae053a","ui/dynamic-element.reel/dynamic-element",{dependencies:["montage/ui/component"],factory:function(require,exports,module){/* <copyright>
Copyright (c) 2012, Motorola Mobility LLC.
All Rights Reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

* Redistributions of source code must retain the above copyright notice,
  this list of conditions and the following disclaimer.

* Redistributions in binary form must reproduce the above copyright notice,
  this list of conditions and the following disclaimer in the documentation
  and/or other materials provided with the distribution.

* Neither the name of Motorola Mobility LLC nor the names of its
  contributors may be used to endorse or promote products derived from this
  software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
POSSIBILITY OF SUCH DAMAGE.
</copyright> */
/**
    module:"matte/ui/dynamic-element.reel"
*/
var Component = require("montage/ui/component").Component;


/**
    The DynamicElement is a general purpose component that aims to expose all the properties of the element as a component.
    @class module:"matte/ui/dynamic-element.reel".DynamicElement
    @extends module:montage/ui/component.Component
*/
exports.DynamicElement = Component.specialize(/** @lends module:"matte/ui/dynamic-element.reel".DynamicElement# */ {

    hasTemplate: {
        value: false
    },

    _innerHTML: {
        value: null
    },

    _usingInnerHTML: {
        value: null
    },

    /**
        The innerHTML displayed as the content of the DynamicElement
        @type {Property}
        @default null
    */
    innerHTML: {
        get: function() {
            return this._innerHTML;
        },
        set: function(value) {
            this._usingInnerHTML = true;
            if (this._innerHTML !== value) {
                this._innerHTML = value;
                this.needsDraw = true;
            }
        }
    },

    /**
        The default html displayed if innerHTML is falsy.
        @type {Property}
        @default {String} ""
    */
    defaultHTML: {
        value: ""
    },

    _allowedTagNames: {
        value: null
    },

    /**
        White list of allowed tags in the innerHTML
        @type {Property}
        @default null
    */
    allowedTagNames: {
        get: function() {
            return this._allowedTagNames;
        },
        set: function(value) {
            if (this._allowedTagNames !== value) {
                this._allowedTagNames = value;
                this.needsDraw = true;
            }
        }
    },



    _range: {
        value: null
    },

    enterDocument: {
        value: function(firstTime) {
            if (firstTime) {
                var range = document.createRange(),
                    className = this.element.className;
                range.selectNodeContents(this.element);
                this._range = range;
            }
        }
    },

    _contentNode: {
        value: null
    },

    draw: {
        value: function() {
            // get correct value
            var displayValue = (this.innerHTML || 0 === this.innerHTML ) ? this.innerHTML : this.defaultHTML,
                content, allowedTagNames = this.allowedTagNames, range = this._range, elements;

            // If this element is inside a Slot or another component that
            // manipulates its contents then the range could be selecting
            // the wrong content. Make sure we have the right stuff:
            range.selectNodeContents(this.element);

            //push to DOM
            if(this._usingInnerHTML) {
                if (allowedTagNames !== null) {
                    //cleanup
                    this._contentNode = null;
                    range.deleteContents();
                    //test for tag white list
                    content = range.createContextualFragment( displayValue );
                    if(allowedTagNames.length !== 0) {
                        elements = content.querySelectorAll("*:not(" + allowedTagNames.join("):not(") + ")");
                    } else {
                        elements = content.childNodes;
                    }
                    if (elements.length === 0) {
                        range.insertNode(content);
                        if(range.endOffset === 0) {
                            // according to https://bugzilla.mozilla.org/show_bug.cgi?id=253609 Firefox keeps a collapsed
                            // range collapsed after insertNode
                            range.selectNodeContents(this.element);
                        }

                    } else {
                        console.warn("Some Elements Not Allowed " , elements);
                    }
                } else {
                    content = this._contentNode;
                    if(content === null) {
                        //cleanup
                        range.deleteContents();
                        this._contentNode = content = document.createTextNode(displayValue);
                        range.insertNode(content);
                        if(range.endOffset === 0) {
                            // according to https://bugzilla.mozilla.org/show_bug.cgi?id=253609 Firefox keeps a collapsed
                            // range collapsed after insert
                            range.selectNodeContents(this.element);
                        }

                    } else {
                        content.data = displayValue;
                    }
                }
            }
        }
    }
});

}})
;
//*/
montageDefine("184f06d","ui/main.reel/main.html",{text:'<!DOCTYPE html><html><head>\n        <meta charset=utf-8>\n        <title>Main</title>\n\n        <link rel=stylesheet href=main.css>\n\n        <script type=text/montage-serialization>\n        {\n            "owner": {\n                "properties": {\n                    "element": {"#": "mainComponent"},\n                    "_newTodoForm": {"#": "newTodoForm"},\n                    "_newTodoInput": {"#": "newTodoField"}\n                }\n            },\n\n            "todoRepetition": {\n                "prototype": "montage/ui/repetition.reel",\n                "properties": {\n                    "element": {"#": "todo-list"}\n                },\n                "bindings": {\n                    "contentController": {"<-": "@owner.todoListController"}\n                }\n            },\n\n            "todoView": {\n                "prototype": "ui/todo-view.reel",\n                "properties": {\n                    "element": {"#": "todoView"}\n                },\n                "bindings": {\n                    "todo": {"<-": "@todoRepetition:iteration.object"}\n                }\n            },\n\n            "main": {\n                "prototype": "matte/ui/dynamic-element.reel",\n                "properties": {\n                    "element": {"#": "main"}\n                },\n                "bindings": {\n                    "classList.has(\'visible\')": {\n                        "<-": "@owner.todos.length > 0"\n                    }\n                }\n            },\n\n            "footer": {\n                "prototype": "matte/ui/dynamic-element.reel",\n                "properties": {\n                    "element": {"#": "footer"}\n                },\n                "bindings": {\n                    "classList.has(\'visible\')": {\n                        "<-": "@owner.todos.length > 0"\n                    }\n                }\n            },\n\n            "toggleAllCheckbox": {\n                "prototype": "native/ui/input-checkbox.reel",\n                "properties": {\n                    "element": {"#": "toggle-all"}\n                },\n                "bindings": {\n                    "checked": {"<->": "@owner.allCompleted"}\n                }\n            },\n\n            "todoCount": {\n                "prototype": "montage/ui/text.reel",\n                "properties": {\n                    "element": {"#": "todo-count"}\n                },\n                "bindings": {\n                    "value": {\n                        "<-": "@owner.todosLeft.length"\n                    }\n                }\n            },\n\n            "todoCountWording": {\n                "prototype": "montage/ui/text.reel",\n                "properties": {\n                    "element": {"#": "todo-count-wording"}\n                },\n                "bindings": {\n                    "value": {"<-": "@owner.todosLeft.length == 1 ? \'item\' : \'items\'"}\n                }\n            },\n\n            "completedCount": {\n                "prototype": "montage/ui/text.reel",\n                "properties": {\n                    "element": {"#": "completed-count"}\n                },\n                "bindings": {\n                    "value": {\n                        "<-": "@owner.todosCompleted.length"\n                    }\n                }\n            },\n\n            "clearCompletedContainer": {\n                "prototype": "matte/ui/dynamic-element.reel",\n                "properties": {\n                    "element": {"#": "clear-completed-container"}\n                },\n                "bindings": {\n                    "classList.has(\'visible\')": {\n                        "<-": "@owner.todosCompleted.length"\n                    }\n                }\n            },\n\n            "clearCompletedButton": {\n                "prototype": "native/ui/button.reel",\n                "properties": {\n                    "element": {"#": "clear-completed"}\n                },\n                "listeners": [\n                    {\n                        "type": "action",\n                        "listener": {"@": "owner"},\n                        "capture": false\n                    }\n                ]\n            }\n        }\n        </script>\n    </head>\n    <body>\n        <div data-montage-id=mainComponent>\n\n            <section id=todoapp>\n                    <header id=header>\n                        <h1>todos</h1>\n                        <form data-montage-id=newTodoForm>\n                            <input data-montage-id=newTodoField id=new-todo placeholder="What needs to be done?" autofocus="">\n                        </form>\n                    </header>\n                    <section data-montage-id=main id=main>\n                        <input data-montage-id=toggle-all id=toggle-all type=checkbox>\n                        <label for=toggle-all>Mark all as complete</label>\n                        <ul data-montage-id=todo-list id=todo-list>\n                            <li data-montage-id=todoView></li>\n                        </ul>\n                    </section>\n                    <footer data-montage-id=footer id=footer>\n                        <span id=todo-count><strong data-montage-id=todo-count>0</strong> <span data-montage-id=todo-count-wording>items</span> left</span>\n                        <div data-montage-id=clear-completed-container id=clear-completed-container>\n                            <button data-montage-id=clear-completed id=clear-completed>Clear completed (<span data-montage-id=completed-count>0</span>)</button>\n                        </div>\n                    </footer>\n                </section>\n                <footer id=info>\n                    <p>Double-click to edit a todo</p>\n                    <p>Created with <a href=http://github.com/montagejs/montage>Montage</a> </p>\n                    <p>Source available at <a href=http://github.com/montagejs/todo-mvc>Montage-TodoMVC</a> </p>\n                    <p>Part of <a href=http://todomvc.com>TodoMVC</a></p>\n                </footer>\n        </div>\n    \n\n</body></html>'});
;
//*/
montageDefine("2e7d2a9","ui/native-control",{dependencies:["montage/ui/component"],factory:function(require,exports,module){/**
    @module montage/ui/native-control
*/

var Component = require("montage/ui/component").Component;

/**
    Base component for all native components, such as RadioButton and Checkbox.
    @class module:montage/ui/native-control.NativeControl
    @extends module:montage/ui/component.Component
 */
var NativeControl = exports.NativeControl = Component.specialize(/** @lends module:montage/ui/native-control.NativeControl# */ {

    hasTemplate: {
        value: false
    },

    willPrepareForDraw: {
        value: function() {
        }
    }
});

//http://www.w3.org/TR/html5/elements.html#global-attributes
NativeControl.addAttributes( /** @lends module:montage/ui/native-control.NativeControl# */ {

/**
    Specifies the shortcut key(s) that gives focuses to or activates the element.
    @see {@link http://www.w3.org/TR/html5/editing.html#the-accesskey-attribute}
    @type {string}
    @default null
*/
    accesskey: null,

/**
    Specifies if the content is editable or not. Valid values are "true", "false", and "inherit".
    @see {@link http://www.w3.org/TR/html5/editing.html#contenteditable}
    @type {string}
    @default null

*/
    contenteditable: null,

/**
    Specifies the ID of a <code>menu</code> element in the DOM to use as the element's context menu.
    @see  {@link http://www.w3.org/TR/html5/interactive-elements.html#attr-contextmenu}
    @type {string}
    @default null
*/
    contextmenu: null,

/**
    Specifies the elements element's text directionality. Valid values are "ltr", "rtl", and "auto".
    @see {@link http://www.w3.org/TR/html5/elements.html#the-dir-attribute}
    @type {string}
    @default null
*/
    dir: null,

/**
    Specifies if the element is draggable. Valid values are "true", "false", and "auto".
    @type {string}
    @default null
    @see {@link http://www.w3.org/TR/html5/dnd.html#the-draggable-attribute}
*/
    draggable: null,

/**
    Specifies the behavior that's taken when an item is dropped on the element. Valid values are "copy", "move", and "link".
    @type {string}
    @see {@link http://www.w3.org/TR/html5/dnd.html#the-dropzone-attribute}
*/
    dropzone: null,

/**
    When specified on an element, it indicates that the element should not be displayed.
    @type {boolean}
    @default false
*/
    hidden: {dataType: 'boolean'},
    //id: null,

/**
    Specifies the primary language for the element's contents and for any of the element's attributes that contain text.
    @type {string}
    @default null
    @see {@link http://www.w3.org/TR/html5/elements.html#attr-lang}
*/
    lang: null,

/**
    Specifies if element should have its spelling and grammar checked by the browser. Valid values are "true", "false".
    @type {string}
    @default null
    @see {@link http://www.w3.org/TR/html5/editing.html#attr-spellcheck}
*/
    spellcheck: null,

/**
    The CSS styling attribute.
    @type {string}
    @default null
    @see {@link http://www.w3.org/TR/html5/elements.html#the-style-attribute}
*/
    style: null,

/**
     Specifies the relative order of the element for the purposes of sequential focus navigation.
     @type {number}
     @default null
     @see {@link http://www.w3.org/TR/html5/editing.html#attr-tabindex}
*/
    tabindex: null,

/**
    Specifies advisory information about the element, used as a tooltip when hovering over the element, and other purposes.
    @type {string}
    @default null
    @see {@link http://www.w3.org/TR/html5/elements.html#the-title-attribute}
*/
    title: null
});

}})
;
//*/
montageDefine("184f06d","ui/todo-view.reel/todo-view",{dependencies:["montage/ui/component"],factory:function(require,exports,module){var Component = require('montage/ui/component').Component;

exports.TodoView = Component.specialize({

    todo: {
        value: null
    },

    editInput: {
        value: null
    },

    constructor: {
        value: function TodoView() {
            this.defineBinding('isCompleted', {
                '<-': 'todo.completed'
            });
        }
    },

    enterDocument: {
        value: function (firstTime) {
            if (firstTime) {
                this.element.addEventListener('dblclick', this, false);
                this.element.addEventListener('blur', this, true);
                this.element.addEventListener('submit', this, false);
            }
        }
    },

    captureDestroyButtonAction: {
        value: function () {
            this.dispatchDestroy();
        }
    },

    dispatchDestroy: {
        value: function () {
            this.dispatchEventNamed('destroyTodo', true, true, {todo: this.todo});
        }
    },

    handleDblclick: {
        value: function () {
            this.isEditing = true;
        }
    },

    _isEditing: {
        value: false
    },

    isEditing: {
        get: function () {
            return this._isEditing;
        },
        set: function (value) {
            if (value === this._isEditing) {
                return;
            }

            if (value) {
                this.classList.add('editing');
            } else {
                this.classList.remove('editing');
            }

            this._isEditing = value;
            this.needsDraw = true;
        }
    },

    _isCompleted: {
        value: false
    },

    isCompleted: {
        get: function () {
            return this._isCompleted;
        },
        set: function (value) {
            if (value === this._isCompleted) {
                return;
            }

            if (value) {
                this.classList.add('completed');
            } else {
                this.classList.remove('completed');
            }

            this._isCompleted = value;
            this.needsDraw = true;
        }
    },

    captureBlur: {
        value: function (evt) {
            if (this.isEditing && this.editInput.element === evt.target) {
                this._submitTitle();
            }
        }
    },

    handleSubmit: {
        value: function (evt) {
            if (this.isEditing) {
                evt.preventDefault();
                this._submitTitle();
            }
        }
    },

    _submitTitle: {
        value: function () {

            var title = this.editInput.value.trim();

            if ('' === title) {
                this.dispatchDestroy();
            } else {
                this.todo.title = title;
            }

            this.isEditing = false;
        }
    },

    draw: {
        value: function () {
            if (this.isEditing) {
                this.editInput.element.focus();
            } else {
                this.editInput.element.blur();
            }
        }
    }

});

}})
;
//*/
montageDefine("2e7d2a9","ui/input-checkbox.reel/input-checkbox",{dependencies:["ui/check-input"],factory:function(require,exports,module){/**
    @module "montage/ui/native/input-checkbox.reel"
    @requires montage/core/core
    @requires montage/ui/check-input
*/
var CheckInput = require("ui/check-input").CheckInput;

/**

    @class module:"montage/ui/native/input-checkbox.reel".InputCheckbox
    @extends module:montage/ui/check-input.CheckInput
*/
var InputCheckbox = exports.InputCheckbox = CheckInput.specialize({

});
InputCheckbox.addAttributes( /** @lends module:"montage/ui/native/input-checkbox.reel".InputCheckbox# */ {

/**
    Specifies if the checkbox control should receive focus when the document loads. Because Montage components are loaded asynchronously after the document has loaded, setting this property has no effect on the element's focus state.
    @type {boolean}
    @default false
*/
    autofocus: {value: false, dataType: 'boolean'},

/**
    Specifies if the checkbox control is disabled.
    @type {boolean}
    @default false
*/
    disabled: {value: false, dataType: 'boolean'},

/**
    Specifies if the checkbox is in it checked state or not.
    @type {boolean}
    @default false
*/
    checked: {value: false, dataType: 'boolean'},

/**
    The value of the id attribute of the form with which to associate the element.
    @type {string}
    @default null
*/
    form: null,

/**
    The name part of the name/value pair associated with this element for the purposes of form submission.
    @type {string}
    @default null
*/
    name: null,

/**
    Specifies if this control is readonly.
    @type {boolean}
    @default false
*/
    readonly: {value: false, dataType: 'boolean'},

/**
    A string the browser displays in a tooltip when the user hovers their mouse over the element.
    @type {string}
    @default null
*/
    title: null,
    /*
    The value associated with the checkbox. Per the WC3 specification, if the element has a <code>value</code> attribute then the value of that attribute's value is returned; otherwise, it returns "on".
    @type {string}
    @default "on"
    */
    value: {value: 'on'}
});

}})
bundleLoaded("index.html.bundle-1-0.js")