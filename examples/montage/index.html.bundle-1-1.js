montageDefine("2e7d2a9","ui/button.reel/button",{dependencies:["ui/native-control","montage/composer/press-composer","montage/collections/dict"],factory:function(require,exports,module){ /*global require, exports*/

/**
    @module "montage/ui/native/button.reel"
*/
var NativeControl = require("ui/native-control").NativeControl,
    PressComposer = require("montage/composer/press-composer").PressComposer,
    Dict = require("montage/collections/dict");

// TODO migrate away from using undefinedGet and undefinedSet

/**
    Wraps a native <code>&lt;button></code> or <code>&lt;input[type="button"]></code> HTML element. The element's standard attributes are exposed as bindable properties.
    @class module:"montage/ui/native/button.reel".Button
    @extends module:montage/ui/native-control.NativeControl
    @fires action
    @fires hold
    @example
<caption>JavaScript example</caption>
var b1 = new Button();
b1.element = document.querySelector("btnElement");
b1.addEventListener("action", function(event) {
    console.log("Got event 'action' event");
});
    @example
<caption>Serialized example</caption>
{
    "aButton": {
        "prototype": "montage/ui/native/button.reel",
        "properties": {
            "element": {"#": "btnElement"}
        },
        "listeners": [
            {
                "type": "action",
                "listener": {"@": "appListener"}
            }
        ]
    },
    "listener": {
        "prototype": "appListener"
    }
}
&lt;button data-montage-id="btnElement"></button>
*/
var Button = exports.Button = NativeControl.specialize(/** @lends module:"montage/ui/native/button.reel".Button# */ {

    /**
        Dispatched when the button is activated through a mouse click, finger tap,
        or when focused and the spacebar is pressed.

        @event action
        @memberof module:"montage/ui/native/button.reel".Button
        @param {Event} event
    */

    /**
        Dispatched when the button is pressed for a period of time, set by
        {@link holdThreshold}.

        @event hold
        @memberof module:"montage/ui/native/button.reel".Button
        @param {Event} event
    */

    _preventFocus: {
        enumerable: false,
        value: false
    },

/**
    Specifies whether the button should receive focus or not.
    @type {boolean}
    @default false
    @event longpress
*/
    preventFocus: {
        get: function () {
            return this._preventFocus;
        },
        set: function (value) {
            if (value === true) {
                this._preventFocus = true;
            } else {
                this._preventFocus = false;
            }
        }
    },


/**
    Enables or disables the Button from user input. When this property is set to <code>false</code>, the "disabled" CSS style is applied to the button's DOM element during the next draw cycle. When set to <code>true</code> the "disabled" CSS class is removed from the element's class list.
*/
    //TODO we should prefer positive properties like enabled vs disabled, get rid of disabled
    enabled: {
        dependencies: ["disabled"],
        get: function () {
            return !this._disabled;
        },
        set: function (value) {
            this.disabled = !value;
        }
    },

    /**
        A Montage converter object used to convert or format the label displayed by the Button instance. When a new value is assigned to <code>label</code>, the converter object's <code>convert()</code> method is invoked, passing it the newly assigned label value.
        @type {Property}
        @default null
    */
    converter: {
        value: null
    },

    /**
      Stores the node that contains this button's value. Only used for
      non-`<input>` elements.
      @private
    */
    _labelNode: {value:undefined, enumerable: false},

    _label: { value: undefined, enumerable: false },

    /**
        The displayed text on the button. In an &lt;input> element this is taken from the element's <code>value</code> attribute. On any other element (including &lt;button>) this is the first child node which is a text node. If one isn't found then it will be created.

        If the button has a non-null <code>converter</code> property, the converter object's <code>convert()</code> method is called on the value before being assigned to the button instance.

        @type {string}
        @default undefined
    */
    label: {
        get: function() {
            return this._label;
        },
        set: function(value) {
            if (value && value.length > 0 && this.converter) {
                try {
                    value = this.converter.convert(value);
                    if (this.error) {
                        this.error = null;
                    }
                } catch(e) {
                    // unable to convert - maybe error
                    this.error = e;
                }
            }

            this._label = value;
            if (this._isInputElement) {
                this._value = value;
            }

            this.needsDraw = true;
        }
    },

    setLabelInitialValue: {
        value: function(value) {
            if (this._label === undefined) {
                    this._label = value;
                }
        }
    },

    /**
        The amount of time in milliseconds the user must press and hold the button a <code>hold</code> event is dispatched. The default is 1 second.
        @type {number}
        @default 1000
    */
    holdThreshold: {
        get: function() {
            return this._pressComposer.longPressThreshold;
        },
        set: function(value) {
            this._pressComposer.longPressThreshold = value;
        }
    },

    _pressComposer: {
        enumberable: false,
        value: null
    },

    _active: {
        enumerable: false,
        value: false
    },

    /**
        This property is true when the button is being interacted with, either through mouse click or touch event, otherwise false.
        @type {boolean}
        @default false
    */
    active: {
        get: function() {
            return this._active;
        },
        set: function(value) {
            this._active = value;
            this.needsDraw = true;
        }
    },

    // HTMLInputElement/HTMLButtonElement methods

    blur: { value: function() { this._element.blur(); } },
    focus: { value: function() { this._element.focus(); } },
    // click() deliberately omitted (it isn't available on <button> anyways)

    constructor: {
        value: function NativeButton () {
            this.super();
            this._pressComposer = new PressComposer();
            this._pressComposer.longPressThreshold = this.holdThreshold;
            this.addComposer(this._pressComposer);
        }
    },

    prepareForActivationEvents: {
        value: function() {
            this._pressComposer.addEventListener("pressStart", this, false);
            this._pressComposer.addEventListener("press", this, false);
            this._pressComposer.addEventListener("pressCancel", this, false);
        }
    },

    // Optimisation
    addEventListener: {
        value: function(type, listener, useCapture) {
            this.super(type, listener, useCapture);
            if (type === "hold") {
                this._pressComposer.addEventListener("longPress", this, false);
            }
        }
    },

    // Handlers

    /**
    Called when the user starts interacting with the component.
    */
    handlePressStart: {
        value: function(event) {
            this.active = true;

            if (event.touch) {
                // Prevent default on touchmove so that if we are inside a scroller,
                // it scrolls and not the webpage
                document.addEventListener("touchmove", this, false);
            }

            if (!this._preventFocus) {
                this._element.focus();
            }
        }
    },

    /**
    Called when the user has interacted with the button.
    */
    handlePress: {
        value: function(event) {
            this.active = false;
            this._dispatchActionEvent();
            document.removeEventListener("touchmove", this, false);
        }
    },

    handleKeyup: {
        value: function(event) {
            // action event on spacebar
            if (event.keyCode === 32) {
                this.active = false;
                this._dispatchActionEvent();
            }
        }
    },

    handleLongPress: {
        value: function(event) {
            // When we fire the "hold" event we don't want to fire the
            // "action" event as well.
            this._pressComposer.cancelPress();

            var holdEvent = document.createEvent("CustomEvent");
            holdEvent.initCustomEvent("hold", true, true, null);
            this.dispatchEvent(holdEvent);
        }
    },

    /**
    Called when all interaction is over.
    @private
    */
    handlePressCancel: {
        value: function(event) {
            this.active = false;
            document.removeEventListener("touchmove", this, false);
        }
    },

    handleTouchmove: {
        value: function(event) {
            event.preventDefault();
        }
    },

    /**
    If this is an input element then the label is handled differently.
    @private
    */
    _isInputElement: {
        value: false,
        enumerable: false
    },

    enterDocument: {
        value: function(firstDraw) {
            if (NativeControl.enterDocument) {
                NativeControl.enterDocument.apply(this, arguments);
            }
            
            if(firstDraw) {
                this._isInputElement = (this.originalElement.tagName === "INPUT");
                // Only take the value from the element if it hasn't been set
                // elsewhere (i.e. in the serialization)
                if (this._isInputElement) {
                    // NOTE: This might not be the best way to do this
                    // With an input element value and label are one and the same
                    Object.defineProperty(this, "value", {
                        get: function() {
                            return this._label;
                        },
                        set: function(value) {
                            this.label = value;
                        }
                    });

                    if (this._label === undefined) {
                        this._label = this.originalElement.value;
                    }
                } else {
                    if (!this.originalElement.firstChild) {
                        this.originalElement.appendChild(document.createTextNode(""));
                    }
                    this._labelNode = this.originalElement.firstChild;
                    this.setLabelInitialValue(this._labelNode.data)
                    if (this._label === undefined) {
                        this._label = this._labelNode.data;
                    }
                }

                //this.classList.add("montage-Button");
                this.element.setAttribute("role", "button");
                this.element.addEventListener("keyup", this, false);
            }
        }
    },

    /**
    Draws the label to the DOM.
    @function
    @private
    */
    _drawLabel: {
        enumerable: false,
        value: function(value) {
            if (this._isInputElement) {
                this._element.setAttribute("value", value);
            } else {
                this._labelNode.data = value;
            }
        }
    },

    draw: {
        value: function() {
            this.super();

            if (this._disabled) {
                this._element.classList.add("disabled");
            } else {
                this._element.classList.remove("disabled");
            }

            if (this._active) {
                this._element.classList.add("active");
            } else {
                this._element.classList.remove("active");
            }

            this._drawLabel(this.label);
        }
    },

    _detail: {
        value: null
    },

    /**
        The data property of the action event.
        example to toggle the complete class: "detail.selectedItem" : { "<-" : "@repetition.objectAtCurrentIteration"}
        @type {Property}
        @default null
    */
    detail: {
        get: function() {
            if (this._detail === null) {
                this._detail = new Dict();
            }
            return this._detail;
        }
    },

    createActionEvent: {
        value: function() {
            var actionEvent = document.createEvent("CustomEvent"),
                eventDetail;

            eventDetail = this._detail;
            actionEvent.initCustomEvent("action", true, true, eventDetail);
            return actionEvent;
        }
    }
});

Button.addAttributes( /** @lends module:"montage/ui/native/button.reel".Button# */{

/**
    Specifies whether the button should be focused as soon as the page is loaded.
    @type {boolean}
    @default false
*/
    autofocus: {value: false, dataType: 'boolean'},

/**
    When true, the button is disabled to user input and "disabled" is added to its CSS class list.
    @type {boolean}
    @default false
*/
    disabled: {value: false, dataType: 'boolean'},

/**
    The value of the id attribute of the form with which to associate the component's element.
    @type {string}
    @default null
*/
    form: null,

/**
    The URL to which the form data will be sumbitted.
    @type {string}
    @default null
*/
    formaction: null,

/**
    The content type used to submit the form to the server.
    @type {string}
    @default null
*/
    formenctype: null,

/**
    The HTTP method used to submit the form.
    @type {string}
    @default null
*/
    formmethod: null,

/**
    Indicates if the form should be validated upon submission.
    @type {boolean}
    @default null
*/
    formnovalidate: {dataType: 'boolean'},

/**
    The target frame or window in which the form output should be rendered.
    @type string}
    @default null
*/
    formtarget: null,

/**
    A string indicating the input type of the component's element.
    @type {string}
    @default "button"
*/
    type: {value: 'button'},

/**
    The name associated with the component's DOM element.
    @type {string}
    @default null
*/
    name: null,

/**
    <strong>Use <code>label</code> to set the displayed text on the button</strong>
    The value associated with the element. This sets the value attribute of
    the button that gets sent when the form is submitted.
    @type {string}
    @default null
    @see label
*/
    value: null

});

}})
;
//*/
montageDefine("2e7d2a9","ui/text-input",{dependencies:["ui/native-control"],factory:function(require,exports,module){/**
    @module montage/ui/text-input
*/
var NativeControl = require("ui/native-control").NativeControl;

/**
    The base class for all text-based input components. You typically won't create instances of this prototype.
    @class module:montage/ui/text-input.TextInput
    @extends module:montage/ui/native-control.NativeControl
    @see {module:"montage/ui/input-date.reel".DateInput}
    @see module:"montage/ui/input-text.reel".InputText
    @see module:"montage/ui/input-number.reel".InputNumber
    @see module:"montage/ui/input-range.reel".RangeInput
    @see module:"montage/ui/textarea.reel".TextArea

*/
var TextInput = exports.TextInput =  NativeControl.specialize(/** @lends module:montage/ui/text-input.TextInput# */ {

    _hasFocus: {
        enumerable: false,
        value: false
    },

    _value: {
        enumerable: false,
        value: null
    },

    _valueSyncedWithInputField: {
        enumerable: false,
        value: false
    },

    /**
        The "typed" data value associated with the input element. When this
        property is set, if the component's <code>converter</code> property is
        non-null then its <code>revert()</code> method is invoked, passing it
        the newly assigned value. The <code>revert()</code> function is
        responsible for validating and converting the user-supplied value to
        its typed format. For example, in the case of a DateInput component
        (which extends TextInput) a user enters a string for the date (for
        example, "10-12-2005"). A <code>DateConverter</code> object is assigned
        to the component's <code>converter</code> property.

        If the comopnent doesn't specify a converter object then the raw value
        is assigned to <code>value</code>.

        @type {string}
        @default null
    */
    value: {
        get: function() {
            return this._value;
        },
        set: function(value, fromInput) {

            if(value !== this._value) {
                if(this.converter) {
                    var convertedValue;
                    try {
                        convertedValue = this.converter.revert(value);
                        this.error = null;
                        this._value = convertedValue;
                    } catch(e) {
                        // unable to convert - maybe error
                        this._value = value;
                        this.error = e;
                    }
                } else {
                    this._value = value;
                }

                if (fromInput) {
                    this._valueSyncedWithInputField = true;
                } else {
                    this._valueSyncedWithInputField = false;
                    this.needsDraw = true;
                }
            }
        }
    },

    // set value from user input
    /**
      @private
    */
    _setValue: {
        value: function() {
            var newValue = this.element.value;
            Object.getPropertyDescriptor(this, "value").set.call(this, newValue, true);
        }
    },

/**
    A reference to a Converter object whose <code>revert()</code> function is invoked when a new value is assigned to the TextInput object's <code>value</code> property. The revert() function attempts to transform the newly assigned value into a "typed" data property. For instance, a DateInput component could assign a DateConverter object to this property to convert a user-supplied date string into a standard date format.
    @type {Converter}
    @default null
    @see {@link module:montage/core/converter.Converter}
*/
    converter:{
        value: null
    },

    _error: {
        value: null
    },

/**
    If an error is thrown by the converter object during a new value assignment, this property is set to <code>true</code>, and schedules a new draw cycle so the the UI can be updated to indicate the error state. the <code>montage--invalidText</code> CSS class is assigned to the component's DOM element during the next draw cycle.
    @type {boolean}
    @default false
*/
    error: {
        get: function() {
            return this._error;
        },
        set: function(v) {
            this._error = v;
            this.errorMessage = this._error ? this._error.message : null;
            this.needsDraw = true;
        }
    },

    _errorMessage: {value: null},

/**
    The message to display when the component is in an error state.
    @type {string}
    @default null
*/
    errorMessage: {
        get: function() {
            return this._errorMessage;
        },
        set: function(v) {
            this._errorMessage = v;
        }
    },

    _updateOnInput: {
        value: true
    },

/**
    When this property and the converter's <code>allowPartialConversion</code> are both true, as the user enters text in the input element each new character is added to the component's <code>value</code> property, which triggers the conversion. Depending on the type of input element being used, this behavior may not be desirable. For instance, you likely would not want to convert a date string as a user is entering it, only when they've completed their input.
    Specifies whether
    @type {boolean}
    @default true
*/
    updateOnInput: {
        get: function() {
            return !!this._updateOnInput;
        },
        set: function(v) {
            this._updateOnInput = v;
        }
    },

    // HTMLInputElement methods

    blur: { value: function() { this._element.blur(); } },
    focus: { value: function() { this._element.focus(); } },
    // select() defined where it's allowed
    // click() deliberately omitted, use focus() instead

    // Callbacks

    enterDocument: {
        value: function(firstTime) {
            if (firstTime) {
                var el = this.element;
                el.addEventListener("focus", this);
                el.addEventListener('input', this);
                el.addEventListener('change', this);
                el.addEventListener('blur', this);
            }
        }
    },

    _setElementValue: {
        value: function(value) {
            this.element.value = (value == null ? '' : value);
        }
    },

    draw: {
        enumerable: false,
        value: function() {
            this.super();

            var el = this.element;

            if (!this._valueSyncedWithInputField) {
                this._setElementValue(this.converter ? this.converter.convert(this._value) : this._value);
            }

            if (this.error) {
                el.classList.add('montage--invalidText');
                el.title = this.error.message || '';
            } else {
                el.classList.remove("montage--invalidText");
                el.title = '';
            }
        }
    },

    didDraw: {
        enumerable: false,
        value: function() {
            if (this._hasFocus && this._value != null) {
                var length = this._value.toString().length;
                this.element.setSelectionRange(length, length);
            }
            // The value might have been changed during the draw if bindings
            // were reified, and another draw will be needed.
            if (!this.needsDraw) {
                this._valueSyncedWithInputField = true;
            }
        }
    },


    // Event handlers

    handleInput: {
        enumerable: false,
        value: function() {
            if (this.converter) {
                if (this.converter.allowPartialConversion === true && this.updateOnInput === true) {
                    this._setValue();
                }
            } else {
                this._setValue();
            }
        }
    },
/**
    Description TODO
    @function
    @param {Event Handler} event TODO
    */
    handleChange: {
        enumerable: false,
        value: function(event) {
            this._setValue();
            this._hasFocus = false;
        }
    },
/**
    Description TODO
    @function
    @param {Event Handler} event TODO
    */
    handleBlur: {
        enumerable: false,
        value: function(event) {
            this._hasFocus = false;
        }
    },
/**
    Description TODO
    @function
    @param {Event Handler} event TODO
    */
    handleFocus: {
        enumerable: false,
        value: function(event) {
            this._hasFocus = true;
        }
    }

});

// Standard <input> tag attributes - http://www.w3.org/TR/html5/the-input-element.html#the-input-element

TextInput.addAttributes({
    accept: null,
    alt: null,
    autocomplete: null,
    autofocus: {dataType: "boolean"},
    checked: {dataType: "boolean"},
    dirname: null,
    disabled: {dataType: 'boolean'},
    form: null,
    formaction: null,
    formenctype: null,
    formmethod: null,
    formnovalidate: {dataType: 'boolean'},
    formtarget: null,
    height: null,
    list: null,
    maxlength: null,
    multiple: {dataType: 'boolean'},
    name: null,
    pattern: null,
    placeholder: null,
    readonly: {dataType: 'boolean'},
    required: {dataType: 'boolean'},
    size: null,
    src: null,
    width: null
    // "type" is not bindable and "value" is handled as a special attribute
});

}})
;
//*/
montageDefine("604e6eb","composer/composer",{dependencies:["../core/core","../core/target"],factory:function(require,exports,module){/**
 * @module montage/composer/composer
 * @requires montage/core/core
 */
var Montage = require("../core/core").Montage,
    Target = require("../core/target").Target;

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
     * @default false
     */
    lazyLoad: {
        value: false
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
        value: function (timestamp) {

        }
    },


    /**
     * Invoked by the framework to default the composer's element to the
     * component's element if necessary.
     * @private
     */
    _resolveDefaults: {
        value: function () {
            if (this.element == null && this.component != null) {
                this.element = this.component.element;
            }
        }
    },

    /**
     * Invoked by the framework to load this composer.
     * @private
     */
    _load: {
        value: function () {
            if (!this.element) {
                this._resolveDefaults();
            }
            this.load();
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
        value: function () {

        }
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
        value: function () {

        }
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

});

}})
;
//*/
montageDefine("2e7d2a9","ui/check-input",{dependencies:["ui/native-control","montage/composer/press-composer"],factory:function(require,exports,module){/*global require, exports */

/**
    @module montage/ui/check-input
*/
var NativeControl = require("ui/native-control").NativeControl,
    PressComposer = require("montage/composer/press-composer").PressComposer;

/**
    The base class for the Checkbox component. You will not typically create this class directly but instead use the Checkbox component.
    @class module:montage/ui/check-input.CheckInput
    @extends module:montage/ui/native-control.NativeControl
*/
exports.CheckInput =  NativeControl.specialize({

    // HTMLInputElement methods

    blur: { value: function() { this._element.blur(); } },
    focus: { value: function() { this._element.focus(); } },
    // click() deliberately omitted, use checked = instead

    // Callbacks
    draw: {
        value: function() {
            this.super();
            this._element.setAttribute("aria-checked", this._checked);
        }
    },

    _pressComposer: {
        enumerable: false,
        value: null
    },

    prepareForActivationEvents: {
        value: function() {
            var pressComposer = this._pressComposer = new PressComposer();
            this.addComposer(pressComposer);
            pressComposer.addEventListener("pressStart", this, false);
            pressComposer.addEventListener("press", this, false);
        }
    },

    enterDocument: {
        value: function(firstTime) {
            if (firstTime) {
                this._element.addEventListener('change', this);
            }
        }
    },

    /**
    Fake the checking of the element.

    Changes the checked property of the element and dispatches a change event.
    Radio button overrides this.

    @private
    */
    _fakeCheck: {
        enumerable: false,
        value: function() {
            var changeEvent;
            // NOTE: this may be BAD, modifying the element outside of
            // the draw loop, but it's what a click/touch would
            // actually have done
            this._element.checked = !this._element.checked;
            changeEvent = document.createEvent("HTMLEvents");
            changeEvent.initEvent("change", true, true);
            this._element.dispatchEvent(changeEvent);
        }
    },

    /**
    Stores if we need to "fake" checking of the input element.

    When preventDefault is called on touchstart and touchend events (e.g. by
    the scroller component) the checkbox doesn't check itself, so we need
    to fake it later.

    @default false
    @private
    */
    _shouldFakeCheck: {
        enumerable: false,
        value: false
    },

    // Handlers

    handlePressStart: {
        value: function(event) {
            this._shouldFakeCheck = event.defaultPrevented;
        }
    },


    handlePress: {
        value: function(event) {
            if (this._shouldFakeCheck) {
                this._shouldFakeCheck = false;
                this._fakeCheck();
            }
        }
    },

    handleChange: {
        enumerable: false,
        value: function(event) {
            if (!this._pressComposer || this._pressComposer.state !== PressComposer.CANCELLED) {
                Object.getPropertyDescriptor(this, "checked").set.call(this,
                    this.element.checked, true);
                this._dispatchActionEvent();
            }
        }
    }
});

}})
;
//*/
montageDefine("604e6eb","ui/text.reel/text",{dependencies:["../component"],factory:function(require,exports,module){/**
 * @module "montage/ui/text.reel"
 */
var Component = require("../component").Component;

/**
 * A Text component shows plain text. Any text can be safely displayed without
 * escaping, but the browser will treat all sequences of white space as a
 * single space.
 *
 * The text component replaces the inner DOM of its element with a TextNode and
 * it renders the [value]{@link Text#value} string in it.
 *
 * @class Text
 * @classdesc A component that displays a string of plain text.
 * @extends Component
 */
exports.Text = Component.specialize( /** @lends Text.prototype # */ {
    /**
     * @constructs Text
     */
    constructor: {
        value: function Text() {
            this.super();
        }
    },

    hasTemplate: {
        value: false
    },

    _value: {
        value: null
    },

    /**
     * The string to be displayed. `null` is equivalent to the empty string.
     * @type {string}
     * @default null
     */
    value: {
        get: function () {
            return this._value;
        },
        set: function (value) {
            if (this._value !== value) {
                this._value = value;
                this.needsDraw = true;
            }
        }
    },

    /**
     * An optional converter for transforming the `value` into the
     * corresponding rendered text.
     * Converters are called at time of draw.
     * @type {?Converter}
     * @default null
    */
    converter: {
        value: null
    },

    /**
     * The default string value assigned to the Text instance.
     * @type {string}
     * @default "" empty string
     */
    defaultValue: {
        value: ""
    },

    _valueNode: {
        value: null
    },

    _RANGE: {
        value: document.createRange()
    },

    enterDocument: {
        value: function (firstTime) {
            if (firstTime) {
                var range = this._RANGE;
                range.selectNodeContents(this.element);
                range.deleteContents();
                this._valueNode = document.createTextNode("");
                range.insertNode(this._valueNode);
                this.element.classList.add("montage-Text");
            }
        }
    },

    draw: {
        value: function () {
            // get correct value
            var value = this._value, displayValue = (value || 0 === value ) ? value : this.defaultValue;

            if (this.converter) {
                displayValue = this.converter.convert(displayValue);
            }

            //push to DOM
            this._valueNode.data = displayValue;
        }
    }

});


}})
;
//*/
montageDefine("604e6eb","core/browser",{dependencies:["montage"],factory:function(require,exports,module){/*global navigator*/
var Montage = require("montage").Montage;

var regExAppleWebKit = new RegExp(/AppleWebKit\/([\d.]+)/);

var Browser = Montage.specialize({
    constructor: {
        value: function Browser(userAgent) {
            this.super();
            this._userAgent = userAgent;
            this._analyze(userAgent);
        }
    },

    _analyze: {
        value: function (userAgent) {
            if (/*isAndroidMobile*/ userAgent.indexOf("Android") > -1 && userAgent.indexOf("Mozilla/5.0") > -1 && userAgent.indexOf("AppleWebKit") > -1) {
                this.android = {};
                var resultAppleWebKitRegEx = regExAppleWebKit.exec(userAgent);
                var appleWebKitVersion = (resultAppleWebKitRegEx === null ? null : parseFloat(regExAppleWebKit.exec(userAgent)[1]));
                this.android.androidBrowser = appleWebKitVersion !== null && appleWebKitVersion < 537;
            }
        }
    },

    _userAgent: {
        value: null
    }

});

var _browser = null;

Montage.defineProperties(exports, {

    browser: {
        get: function () {
            if(_browser === null) {
                _browser = new Browser(navigator.userAgent);
            }
            return _browser;
        }
    },

    Browser: {
        value: Browser
    }

});

}})
;
//*/
montageDefine("bae053a","package.json",{exports: {"name":"matte","version":"0.2.0","repository":{"type":"git","url":"https://github.com/montagejs/matte.git"},"dependencies":{"montage":"~0.14.0","native":"~0.2.0"},"devDependencies":{"montage-testing":"~0.4.0"},"exclude":["overview.html","overview","run-tests.html","test"],"readmeFilename":"README.md","description":"matte ==============","bugs":{"url":"https://github.com/montagejs/matte/issues"},"homepage":"https://github.com/montagejs/matte","_id":"matte@0.2.0","_shasum":"6e6b71e7657650bf506b37e26da5073ef94cd6a4","_resolved":"git+http://github.com/montagejs/matte.git#2bf2a53d5e622ec6aefc298507c03c0ec113d8dc","_from":"matte@0.2.0","hash":"bae053a","mappings":{"montage":{"name":"montage","hash":"604e6eb","location":"../montage@604e6eb/"},"native":{"name":"native","hash":"2e7d2a9","location":"../native@2e7d2a9/"}},"production":true,"useScriptInjection":true}})
bundleLoaded("index.html.bundle-1-1.js")