'use strict';

const PET_BASE_WIDTH = 400;
const PET_BASE_HEIGHT = 600;
const PET_MIN_SCALE = 0.5;
const PET_MAX_SCALE = 2.0;

function getPetScaleBounds(workArea) {
    const widthLimit = Number(workArea?.width) / PET_BASE_WIDTH;
    const heightLimit = Number(workArea?.height) / PET_BASE_HEIGHT;
    const availableLimit = Math.min(widthLimit, heightLimit);
    const maxScale = Math.max(PET_MIN_SCALE, Math.min(PET_MAX_SCALE, availableLimit || PET_MAX_SCALE));
    return { min: PET_MIN_SCALE, max: maxScale };
}

function clampPetScale(value, workArea) {
    const numericValue = Number(value);
    const safeValue = Number.isFinite(numericValue) ? numericValue : 1;
    const bounds = getPetScaleBounds(workArea);
    return Math.round(Math.max(bounds.min, Math.min(bounds.max, safeValue)) * 100) / 100;
}

function getPetWindowSize(scale) {
    return {
        width: Math.round(PET_BASE_WIDTH * scale),
        height: Math.round(PET_BASE_HEIGHT * scale),
    };
}

module.exports = {
    PET_BASE_WIDTH,
    PET_BASE_HEIGHT,
    PET_MIN_SCALE,
    PET_MAX_SCALE,
    getPetScaleBounds,
    clampPetScale,
    getPetWindowSize,
};
