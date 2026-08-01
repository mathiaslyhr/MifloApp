import {TOUR_STEPS, useTourStore} from '../tourStore';

describe('tourStore', () => {
  beforeEach(() => {
    useTourStore.setState({active: false, step: 0});
  });

  it('start() activates at step 0', () => {
    useTourStore.getState().start();
    expect(useTourStore.getState()).toMatchObject({active: true, step: 0});
  });

  it('next() walks every step then deactivates', () => {
    useTourStore.getState().start();
    for (let i = 1; i < TOUR_STEPS.length; i++) {
      useTourStore.getState().next();
      expect(useTourStore.getState().step).toBe(i);
      expect(useTourStore.getState().active).toBe(true);
    }
    useTourStore.getState().next();
    expect(useTourStore.getState().active).toBe(false);
  });

  it('stop() deactivates mid-tour', () => {
    useTourStore.getState().start();
    useTourStore.getState().next();
    useTourStore.getState().stop();
    expect(useTourStore.getState().active).toBe(false);
  });

  it('restart begins at step 0 again', () => {
    useTourStore.getState().start();
    useTourStore.getState().next();
    useTourStore.getState().stop();
    useTourStore.getState().start();
    expect(useTourStore.getState()).toMatchObject({active: true, step: 0});
  });

  it('steps bookend with centered cards and cover every tab', () => {
    expect(TOUR_STEPS[0].target).toBeNull();
    expect(TOUR_STEPS[TOUR_STEPS.length - 1].target).toBeNull();
    const tabs = new Set(TOUR_STEPS.map(s => s.tab));
    expect(tabs).toEqual(new Set(['home', 'daily', 'play', 'profile']));
  });
});
