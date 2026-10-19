import React from 'react';

/**
 * Vintel Tool intentionally disables the automatic first-visit onboarding tour.
 * Keep the regular Tutorials tab and manually opened bot-builder guides available.
 * Returning null here prevents desktop and mobile welcome tours from appearing,
 * regardless of first-visit tokens or browser storage.
 */
const OnboardTourHandler: React.FC<{ is_mobile: boolean }> = () => null;

export default OnboardTourHandler;
