"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.favouriteRunnerStatus = favouriteRunnerStatus;
function favouriteRunnerStatus(item) {
    var _a;
    const ps = String((_a = item.participant_status) !== null && _a !== void 0 ? _a : '').trim();
    if (ps === '')
        return item.race_status; // older API / local row without the field
    if (ps !== 'not_started')
        return ps; // finished | in_progress | DNF | DNS | DSQ | other feed code
    if (item.has_started === true)
        return 'in_progress';
    return item.race_status === 'in_progress' ? 'in_progress' : 'not_started';
}
