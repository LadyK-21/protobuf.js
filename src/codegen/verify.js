"use strict";

/**
 * Runtime message verifier using code generation on top of reflection that also provides a fallback.
 * @exports codegen.verify
 * @namespace
 */
var verify = exports;

var Enum    = require("../enum"),
    Type    = require("../type"),
    util    = require("../util"),
    codegen = require("../codegen");

/**
 * Verifies a runtime message of `this` message type.
 * @param {Message|Object} message Runtime message or plain object to verify
 * @returns {?string} `null` if valid, otherwise the reason why it is not
 * @this {Type}
 */
verify.fallback = function verify_fallback(message) {
    var fields = this.getFieldsArray(),
        i = 0;
    while (i < fields.length) {
        var field = fields[i++].resolve(),
            value = message[field.name];

        if (value === undefined) {
            if (field.required)
                return "missing required field " + field.name + " in " + this.getFullName();

        } else if (field.resolvedType instanceof Enum && field.resolvedType.getValuesById()[value] === undefined) {
            return "invalid enum value " + field.name + " = " + value + " in " + this.getFullName();

        } else if (field.resolvedType instanceof Type) {
            if (!value && field.required)
                return "missing required field " + field.name + " in " + this.getFullName();
            var reason;
            if ((reason = field.resolvedType.verify(value)) !== null)
                return reason;
        }
    }
    return null;
};

/**
 * Generates a verifier specific to the specified message type, with an identical signature to {@link codegen.verify.fallback}.
 * @param {Type} mtype Message type
 * @returns {CodegenInstance} {@link codegen|Codegen} instance
 */
verify.generate = function verify_generate(mtype) {
    /* eslint-disable no-unexpected-multiline */
    var fields = mtype.getFieldsArray();
    var gen = codegen("m");
    var hasReasonVar = false;

    for (var i = 0; i < fields.length; ++i) {
        var field = fields[i].resolve(),
            prop  = util.safeProp(field.name);
        if (field.required) { gen

            ("if(m%s===undefined)", prop)
                ("return 'missing required field %s in %s'", field.name, mtype.getFullName());

        } else if (field.resolvedType instanceof Enum) {
            var values = util.toArray(field.resolvedType.values); gen

            ("switch(m%s){", prop)
                ("default:")
                    ("return 'invalid enum value %s = '+m%s+' in %s'", field.name, prop, mtype.getFullName());

            for (var j = 0, l = values.length; j < l; ++j) gen
                ("case %d:", values[j]); gen
            ("}");

        } else if (field.resolvedType instanceof Type) {
            if (field.required) gen

            ("if(!m%s)", prop)
                ("return 'missing required field %s in %s'", field.name, mtype.getFullName());

            if (!hasReasonVar) { gen("var r"); hasReasonVar = true; } gen

            ("if((r=types[%d].verify(m%s))!==null)", i, prop)
                ("return r");
        }
    }
    return gen
    ("return null");
    /* eslint-enable no-unexpected-multiline */
};
