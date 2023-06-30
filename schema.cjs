const fs = require("fs")
const path = require("path")
const Ajv = require("ajv")
const addFormats = require('ajv-formats')
const standaloneCode = require("ajv/dist/standalone").default

const schema = JSON.parse(fs.readFileSync(path.join(__dirname, "schema.json"), 'utf-8'))

// The generated code will have a default export:
// `module.exports = <validateFunctionCode>;module.exports.default = <validateFunctionCode>;`
const ajv = new Ajv({
    code: {source: true, esm: true},
    discriminator: true,
})
addFormats(ajv);

const validate = ajv.compile(schema)
let moduleCode = standaloneCode(ajv, validate)

// Now you can write the module code to file
fs.writeFileSync(path.join(__dirname, "validate.mjs"), moduleCode)
