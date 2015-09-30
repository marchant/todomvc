montageDefine("666a351","composer/press-composer",{dependencies:["../core/core","./composer","../core/event/mutable-event"],factory:function(require,exports,module){/*global require, exports*/

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
            if (window.PointerEvent) {
                this._element.addEventListener("pointerdown", this, true);

            } else if (window.navigator.msPointerEnabled) {
                this._element.addEventListener("MSPointerDown", this, true);

            } else {
                this._element.addEventListener("touchstart", this, true);
                this._element.addEventListener("mousedown", this, true);
            }
        }
    },

    unload: {
        value: function () {
            if (window.PointerEvent) {
                this._element.removeEventListener("pointerdown", this, true);

            } else if (window.navigator.msPointerEnabled) {
                this._element.removeEventListener("MSPointerDown", this, true);

            } else {
                this._element.removeEventListener("touchstart", this, true);
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
        value: 0
    },
    state: {
        get: function () {
            return this._state;
        }
    },

    _shouldDispatchLongPress: {
        value: false
    },

    _longPressThreshold: {
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
        value: null
    },

    // Magic

    _observedPointer: {
        value: null
    },

    /**
     * Remove event listeners after an interaction has finished.
     * @private
     */
    _endInteraction: {
        value: function () {
            if (this._element) {
                if (window.navigator.msPointerEnabled) {
                    document.removeEventListener("MSPointerUp", this, false);
                    document.removeEventListener("MSPointerCancel", this, false);

                } else if (window.PointerEvent) {
                    document.removeEventListener("pointerup", this, false);
                    document.removeEventListener("pointercancel", this, false);

                } else {
                    if (this._observedPointer === "mouse") {
                        document.removeEventListener("mouseup", this, false);

                    } else {
                        document.removeEventListener("touchend", this, false);
                        document.removeEventListener("touchcancel", this, false);
                    }
                }

                this._element.removeEventListener("dragstart", this, false);

                if (this.component.eventManager.isPointerClaimedByComponent(this._observedPointer, this)) {
                    this.component.eventManager.forfeitPointer(this._observedPointer, this);
                }

                this._observedPointer = null;
                this._state = PressComposer.UNPRESSED;
            }
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
            this._endInteraction();

            return true;
        }
    },

    _shouldPerformPress: {
        value: function () {
            return !(("enabled" in this.component && !this.component.enabled) || this._observedPointer !== null);
        }
    },

    // Handlers

    capturePointerdown: {
        value: function (event) {
            if (event.pointerType === "touch" || (window.MSPointerEvent && event.pointerType === window.MSPointerEvent.MSPOINTER_TYPE_TOUCH)) {
                this.captureTouchstart(event);

            } else if (event.pointerType === "mouse" || (window.MSPointerEvent && event.pointerType === window.MSPointerEvent.MSPOINTER_TYPE_MOUSE)) {
                this.captureMousedown(event);
            }
        }
    },

    handlePointerup: {
        value: function (event) {
            if (event.pointerType === "touch" || (window.MSPointerEvent && event.pointerType === window.MSPointerEvent.MSPOINTER_TYPE_TOUCH)) {
                this.handleTouchend(event);

            } else if (event.pointerType === "mouse" || (window.MSPointerEvent && event.pointerType === window.MSPointerEvent.MSPOINTER_TYPE_MOUSE)) {
                this.handleMouseup(event);
            }
        }
    },

    handlePointercancel: {
        value: function (event) {
            this.handleTouchcancel(event);
        }
    },

    captureTouchstart: {
        value: function (event) {
            if (this._shouldPerformPress()) {
                if (event.pointerId !== void 0) { // -> pointer events support.
                    this._observedPointer = event.pointerId;

                } else if (event.changedTouches && event.changedTouches.length === 1) {
                    this._observedPointer = event.changedTouches[0].identifier;
                }

                if (this._observedPointer !== null && this.component.eventManager.claimPointer(this._observedPointer, this)) {
                    if (window.navigator.msPointerEnabled) {
                        document.addEventListener("MSPointerUp", this, false);
                        document.addEventListener("MSPointerCancel", this, false);

                    } else if (window.PointerEvent) {
                        document.addEventListener("pointerup", this, false);
                        document.addEventListener("pointercancel", this, false);

                    } else {
                        document.addEventListener("touchend", this, false);
                        document.addEventListener("touchcancel", this, false);
                    }

                    this._dispatchPressStart(event);

                } else {
                    this._observedPointer = null;
                }
            }
        }
    },

    handleTouchend: {
        value: function (event) {
            if (this._observedPointer === null) {
                this._endInteraction(event);
                return;
            }

            var target;

            if ((window.PointerEvent || window.navigator.msPointerEnabled) && event.pointerId === this._observedPointer)  {
                target = event.target;

            } else if (this._changedTouchisObserved(event.changedTouches) !== false) {
                var touch = event.changedTouches[0];
                target = document.elementFromPoint(touch.clientX, touch.clientY);
            }

            if (target && this.component.eventManager.isPointerClaimedByComponent(this._observedPointer, this)) {
                if (this.element === target || this.element.contains(target)) {
                    this._dispatchPress(event);

                } else {
                    this._dispatchPressCancel(event);
                }

                this._endInteraction(event);
            }
        }
    },

    handleTouchcancel: {
        value: function (event) {
            if (this._observedPointer === null || event.pointerId === this._observedPointer || this._changedTouchisObserved(event.changedTouches) !== false) {
                if (this.component.eventManager.isPointerClaimedByComponent(this._observedPointer, this)) {
                    this._dispatchPressCancel(event);
                }

                this._endInteraction(event);
            }
        }
    },

    captureMousedown: {
        value: function (event) {
            if (event.button === 0 && this._shouldPerformPress()) {
                this._observedPointer = "mouse";
                this.component.eventManager.claimPointer(this._observedPointer, this);

                if (this.component.eventManager.isPointerClaimedByComponent(this._observedPointer, this)) {
                    // Needed to cancel the press if mouseup'd when not on the component
                    if (window.navigator.msPointerEnabled) {
                        document.addEventListener("MSPointerUp", this, false);

                    } else if (window.PointerEvent) {
                        document.addEventListener("pointerup", this, false);

                    } else {
                        document.addEventListener("mouseup", this, false);
                    }

                    // Needed to cancel the press because once a drag is started
                    // no mouse events are fired
                    // http://www.whatwg.org/specs/web-apps/current-work/multipage/dnd.html#initiate-the-drag-and-drop-operation
                    this._element.addEventListener("dragstart", this, false);

                    this._dispatchPressStart(event);
                } else{
                    this._observedPointer = null;
                }
            }
        }
    },

    handleMouseup: {
        value: function (event) {
            if (this._observedPointer === null) {
                this._endInteraction(event);
                return;
            }

            if (this.component.eventManager.isPointerClaimedByComponent(this._observedPointer, this)) {
                var target = event.target;

                while (target !== this._element && target && target.parentNode) {
                    target = target.parentNode;
                }

                if (target === this._element) {
                    this._dispatchPress(event);
                    this._endInteraction(event);
                    return;
                }
            }

            this._dispatchPressCancel(event);
            this._endInteraction(event);
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
            var contactPoint = event,
                pressEvent, index;

            if (!event) {
                event = document.createEvent("CustomEvent");
                event.initCustomEvent(name, true, true, null);
            }

            pressEvent = new PressEvent();
            pressEvent.event = event;
            pressEvent.type = name;
            pressEvent.pointer = this._observedPointer;
            pressEvent.targetElement = event.target;

            if (event.changedTouches && (index = this._changedTouchisObserved(event.changedTouches)) !== false) {
                contactPoint = pressEvent.touch = event.changedTouches[index];
            }

            if (contactPoint) { // a PressCancel event can be dispatched programtically, so with no event.
                pressEvent.clientX = contactPoint.clientX;
                pressEvent.clientY = contactPoint.clientY;
                pressEvent.pageX = contactPoint.pageX;
                pressEvent.pageY = contactPoint.pageY;
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

PressComposer.prototype.captureMSPointerDown = PressComposer.prototype.capturePointerdown;
PressComposer.prototype.handleMSPointerUp = PressComposer.prototype.handlePointerup;
PressComposer.prototype.handleMSPointerCancel = PressComposer.prototype.handlePointercancel;

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
montageDefine("94d26d8","ui/main.reel/main.html",{text:'<!DOCTYPE html><html><head>\n        <meta charset=utf-8>\n        <title>Main</title>\n\n        <link rel=stylesheet href=main.css>\n\n        <script type=text/montage-serialization>\n        {\n            "owner": {\n                "properties": {\n                    "element": {"#": "mainComponent"},\n                    "_newTodoForm": {"#": "newTodoForm"},\n                    "_newTodoInput": {"#": "newTodoField"}\n                }\n            },\n\n            "todoRepetition": {\n                "prototype": "montage/ui/repetition.reel",\n                "properties": {\n                    "element": {"#": "todo-list"}\n                },\n                "bindings": {\n                    "contentController": {"<-": "@owner.todoListController"}\n                }\n            },\n\n            "todoView": {\n                "prototype": "ui/todo-view.reel",\n                "properties": {\n                    "element": {"#": "todoView"}\n                },\n                "bindings": {\n                    "todo": {"<-": "@todoRepetition:iteration.object"}\n                }\n            },\n\n            "main": {\n                "prototype": "matte/ui/dynamic-element.reel",\n                "properties": {\n                    "element": {"#": "main"}\n                },\n                "bindings": {\n                    "classList.has(\'visible\')": {\n                        "<-": "@owner.todos.length > 0"\n                    }\n                }\n            },\n\n            "footer": {\n                "prototype": "matte/ui/dynamic-element.reel",\n                "properties": {\n                    "element": {"#": "footer"}\n                },\n                "bindings": {\n                    "classList.has(\'visible\')": {\n                        "<-": "@owner.todos.length > 0"\n                    }\n                }\n            },\n\n            "toggleAllCheckbox": {\n                "prototype": "native/ui/input-checkbox.reel",\n                "properties": {\n                    "element": {"#": "toggle-all"}\n                },\n                "bindings": {\n                    "checked": {"<->": "@owner.allCompleted"}\n                }\n            },\n\n            "todoCount": {\n                "prototype": "montage/ui/text.reel",\n                "properties": {\n                    "element": {"#": "todo-count"}\n                },\n                "bindings": {\n                    "value": {\n                        "<-": "@owner.todosLeft.length"\n                    }\n                }\n            },\n\n            "todoCountWording": {\n                "prototype": "montage/ui/text.reel",\n                "properties": {\n                    "element": {"#": "todo-count-wording"}\n                },\n                "bindings": {\n                    "value": {"<-": "@owner.todosLeft.length == 1 ? \'item\' : \'items\'"}\n                }\n            },\n\n            "completedCount": {\n                "prototype": "montage/ui/text.reel",\n                "properties": {\n                    "element": {"#": "completed-count"}\n                },\n                "bindings": {\n                    "value": {\n                        "<-": "@owner.todosCompleted.length"\n                    }\n                }\n            },\n\n            "clearCompletedContainer": {\n                "prototype": "matte/ui/dynamic-element.reel",\n                "properties": {\n                    "element": {"#": "clear-completed-container"}\n                },\n                "bindings": {\n                    "classList.has(\'visible\')": {\n                        "<-": "@owner.todosCompleted.length"\n                    }\n                }\n            },\n\n            "clearCompletedButton": {\n                "prototype": "native/ui/button.reel",\n                "properties": {\n                    "element": {"#": "clear-completed"}\n                },\n                "listeners": [\n                    {\n                        "type": "action",\n                        "listener": {"@": "owner"},\n                        "capture": false\n                    }\n                ]\n            }\n        }\n        </script>\n    </head>\n    <body>\n        <div data-montage-id=mainComponent>\n\n            <section id=todoapp>\n                    <header id=header>\n                        <h1>todos</h1>\n                        <form data-montage-id=newTodoForm>\n                            <input data-montage-id=newTodoField id=new-todo placeholder="What needs to be done?" autofocus="">\n                        </form>\n                    </header>\n                    <section data-montage-id=main id=main>\n                        <input data-montage-id=toggle-all id=toggle-all type=checkbox>\n                        <label for=toggle-all>Mark all as complete</label>\n                        <ul data-montage-id=todo-list id=todo-list>\n                            <li data-montage-id=todoView></li>\n                        </ul>\n                    </section>\n                    <footer data-montage-id=footer id=footer>\n                        <span id=todo-count><strong data-montage-id=todo-count>0</strong> <span data-montage-id=todo-count-wording>items</span> left</span>\n                        <div data-montage-id=clear-completed-container id=clear-completed-container>\n                            <button data-montage-id=clear-completed id=clear-completed>Clear completed (<span data-montage-id=completed-count>0</span>)</button>\n                        </div>\n                    </footer>\n                </section>\n                <footer id=info>\n                    <p>Double-click to edit a todo</p>\n                    <p>Created with <a href=http://github.com/montagejs/montage>Montage</a> </p>\n                    <p>Source available at <a href=http://github.com/montagejs/todo-mvc>Montage-TodoMVC</a> </p>\n                    <p>Part of <a href=http://todomvc.com>TodoMVC</a></p>\n                </footer>\n        </div>\n    \n\n</body></html>'});
;
//*/
montageDefine("666a351","composer/composer",{dependencies:["../core/target"],factory:function(require,exports,module){/**
 * @module montage/composer/composer
 * @requires montage/core/target
 */
var Target = require("../core/target").Target;

/**
 * The `Composer` helps to keep event normalization and calculation out of
 * specific `Component`s and in a reusable place. For example, the
 * `TranslateComposer` handles listening to different mouse and touch events
 * that represent dragging, and emits common `translate` events with helpful
 * information about the move.
 *
 * Specific composersshould specialize this `Composer` class and implement the
 * `load` and `unload` methods to attach and remove their event listeners.
 * Subclasses can also implement `frame` if they need access to their
 * component's draw cycle.
 *
 * @classdesc Abstracts a pattern of DOM events, emitting more useful,
 * higher-level events.
 * @class Composer
 * @extends Target
 */
exports.Composer = Target.specialize( /** @lends Composer# */ {

    _component: {
        value: null
    },

    /**
     * The Montage `Component` this `Composer` is attached to. Each composer is
     * attached to a single component. By default, most composer will listen to
     * DOM events on this component's element. This is also the component whose
     * draw cycle is affected by `needsFrame` and `frame`.
     * @type {Component}
     * @default null
     */
    component: {
        get: function () {
            return this._component;
        },
        set: function (component) {
            this._component = component;
        }
    },

    _element: {
        value: null
    },

    /**
     * The DOM element where the composer will listen for events. If no element
     * is specified then the composer will use the element associated with its
     * `component` property.
     *
     * Subclasses may want to set their `element` to something other than the
     * component's element during `load` for certain event patterns. One common
     * pattern is to set element to `window` to listen for events anywhere on
     * the page.
     * @type {Element}
     * @default null
     */
    element: {
        get: function () {
            return this._element;
        },
        set: function (element) {
            this._element = element;
        }
    },


    /**
     * This property controls when the component will call this composer's
     * `load` method, which is where the composer adds its event listeners:
     *
     * - If `false`, the component will call `load` during the next draw cycle
     *   after the composer is added to it.
     * - If `true`, the component will call `load` after its
     *   `prepareForActivationEvents`.
     *
     * Delaying the creation of event listeners can improve performance.
     * @default true
     */
    lazyLoad: {
        value: true
    },

    _needsFrame: {
        value: false
    },

    /**
     * This property should be set to 'true' when the composer wants to have
     * its `frame()` method executed during the next draw cycle. Setting this
     * property to 'true' will cause Montage to schedule a new draw cycle if
     * one has not already been scheduled.
     * @type {boolean}
     * @default false
     */
    needsFrame: {
        set: function (value) {
            if (this._needsFrame !== value) {
                this._needsFrame = value;
                if (this._component) {
                    if (value) {
                        this._component.scheduleComposer(this);
                    }
                }
            }
        },
        get: function () {
            return this._needsFrame;
        }
    },

    /**
     * This method will be invoked by the framework at the beginning of a draw
     * cycle. This is where a composer may implement its update logic if it
     * needs to respond to draws by its component.
     * @function
     * @param {Date} timestamp The time that the draw cycle started
     */
    frame: {
        value: Function.noop
    },


    /**
     * Invoked by the framework to default the composer's element to the
     * component's element if necessary.
     * @private
     */
    _resolveDefaults: {
        value: function () {
            if (!this.element && this.element == null && this.component != null) {
                this.element = this.component.element;
            }
        }
    },

    _isLoaded: {
        value: false
    },

    isLoaded: {
        get: function () {
            return this._isLoaded;
        }
    },

    /**
     * The component calls `load` on its composers when they should initialize
     * themselves. Exactly when this happens is controlled by the composer's
     * `lazyLoad` property.
     *
     * Subclasses should override `load` with their DOM initialization. Most
     * composers attach DOM event listeners to `this.element` in `load`.
     *
     * @function
     */
    load: {
        value: Function.noop
    },

    /**
     * The `component` will call `unload` when the composer is removed from the
     * component or the component is removed.
     *
     * Subclasses should override `unload` to do any necessary cleanup, such as
     * removing event listeners.
     *
     * @function
     */
    unload: {
        value: Function.noop
    },

    /**
     * Called when a composer is part of a template serialization. It's
     * responsible for calling `addComposer` on the component.
     * @private
     */
    deserializedFromTemplate: {
        value: function () {
            if (this.component) {
                this.component.addComposer(this);
            }
        }
    }

}, {

    isCoordinateOutsideRadius: {
        value: function (x, y, radius) {
            return x * x + y * y > radius * radius;
        }
    }

});

}})
;
//*/
montageDefine("94d26d8","ui/todo-view.reel/todo-view",{dependencies:["montage/ui/component"],factory:function(require,exports,module){var Component = require('montage/ui/component').Component;

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
        value: function () {
            this.element.addEventListener('dblclick', this, false);
            this.element.addEventListener('blur', this, true);
            this.element.addEventListener('submit', this, false);
        }
    },

    exitDocument: {
        value: function () {
            this.element.removeEventListener('dblclick', this, false);
            this.element.removeEventListener('blur', this, true);
            this.element.removeEventListener('submit', this, false);
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
montageDefine("94d26d8","ui/todo-view.reel/todo-view.html",{text:'<!DOCTYPE html><html><head>\n        <meta charset=utf-8>\n        <title>TodoView</title>\n\n        <script type=text/montage-serialization>\n        {\n            "owner": {\n                "properties": {\n                    "element": {"#": "todoView"},\n                    "editInput": {"@": "editInput"}\n                }\n            },\n\n            "todoTitle": {\n                "prototype": "montage/ui/text.reel",\n                "properties": {\n                    "element": {"#": "todoTitle"}\n                },\n                "bindings": {\n                    "value": {"<-": "@owner.todo.title"}\n                }\n            },\n\n            "todoCompletedCheckbox": {\n                "prototype": "native/ui/input-checkbox.reel",\n                "properties": {\n                    "element": {"#": "todoCompletedCheckbox"}\n                },\n                "bindings": {\n                    "checked": {"<->": "@owner.todo.completed"}\n                }\n            },\n\n            "destroyButton": {\n                "prototype": "native/ui/button.reel",\n                "properties": {\n                    "element": {"#": "destroyButton"}\n                },\n                "listeners": [\n                    {\n                        "type": "action",\n                        "listener": {"@": "owner"},\n                        "capture": true\n                    }\n                ]\n            },\n\n            "editInput": {\n                "prototype": "native/ui/input-text.reel",\n                "properties": {\n                    "element": {"#": "edit-input"}\n                },\n                "bindings": {\n                    "value": {"<-": "@owner.todo.title"}\n                }\n            }\n        }\n        </script>\n    </head>\n    <body>\n        <li data-montage-id=todoView>\n            <div class=view>\n                <input data-montage-id=todoCompletedCheckbox class=toggle type=checkbox>\n                <label data-montage-id=todoTitle></label>\n                <button data-montage-id=destroyButton class=destroy></button>\n            </div>\n            <form data-montage-id=edit>\n                <input data-montage-id=edit-input class=edit value="Rule the web">\n            </form>\n        </li>\n    \n\n</body></html>'});
;
//*/
montageDefine("f5e1a7f","package.json",{exports: {"name":"matte","version":"0.2.0","repository":{"type":"git","url":"git+https://github.com/montagejs/matte.git"},"dependencies":{"montage":"~0.14.0","native":"~0.2.0"},"devDependencies":{"montage-testing":"~0.4.0"},"exclude":["overview.html","overview","run-tests.html","test"],"description":"matte ==============","bugs":{"url":"https://github.com/montagejs/matte/issues"},"_id":"matte@0.2.0","dist":{"shasum":"8b48052c79ac34f297a258743ea32594dc5c0a2c","tarball":"http://registry.npmjs.org/matte/-/matte-0.2.0.tgz"},"_from":"matte@0.2.0","_npmVersion":"1.3.11","_npmUser":{"name":"montage-bot","email":"francoisfrisch@gmail.com"},"maintainers":[{"name":"francoisfrisch","email":"francoisfrisch@gmail.com"},{"name":"montage-bot","email":"francoisfrisch@gmail.com"}],"directories":{},"_shasum":"8b48052c79ac34f297a258743ea32594dc5c0a2c","_resolved":"https://registry.npmjs.org/matte/-/matte-0.2.0.tgz","homepage":"https://github.com/montagejs/matte#readme","hash":"f5e1a7f","mappings":{"montage":{"name":"montage","hash":"666a351","location":"../montage@666a351/"},"native":{"name":"native","hash":"e396087","location":"../native@e396087/"}},"production":true,"useScriptInjection":true}})
;
//*/
montageDefine("94d26d8","core/todo",{dependencies:["montage"],factory:function(require,exports,module){var Montage = require('montage').Montage;

exports.Todo = Montage.specialize({

    constructor: {
        value: function Todo() {
            this.super();
        }
    },

    initWithTitle: {
        value: function (title) {
            this.title = title;
            return this;
        }
    },

    title: {
        value: null
    },

    completed: {
        value: false
    }

});

}})
bundleLoaded("index.html.bundle-1-1.js")