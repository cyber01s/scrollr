export const MOTION = {
  spring: {
    type: 'spring',
    stiffness: 320,
    damping: 26,
    mass: 0.8
  },
  springFast: {
    type: 'spring',
    stiffness: 480,
    damping: 32
  },
  ease: {
    duration: 0.28,
    ease: [0.25, 0.1, 0.25, 1.0]
  },
  easeSlow: {
    duration: 0.5,
    ease: [0.16, 1, 0.3, 1]
  },
  stagger: 0.04
};
