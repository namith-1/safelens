"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setContext = setContext;
exports.getContext = getContext;
let _context;
function setContext(context) {
    _context = context;
}
function getContext() {
    if (!_context) {
        throw new Error('Extension context not initialized');
    }
    return _context;
}
//# sourceMappingURL=shareExtesnion.js.map