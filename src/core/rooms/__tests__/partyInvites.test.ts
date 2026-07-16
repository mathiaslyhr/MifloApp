/**
 * @format
 */
import {mapPartyInvite} from '../roomService';

describe('mapPartyInvite', () => {
  const row = {
    id: 'i1',
    created_at: '2026-07-16T10:00:00Z',
    from_user_id: 'u1',
    display_name: 'Anna',
    avatar_path: 'a/b.jpg',
    code: 'ABC123',
    joined: false,
    joinable: true,
  };

  it('maps snake_case rows to the client shape', () => {
    expect(mapPartyInvite(row)).toEqual({
      id: 'i1',
      createdAt: '2026-07-16T10:00:00Z',
      profile: {userId: 'u1', displayName: 'Anna', avatarPath: 'a/b.jpg'},
      code: 'ABC123',
      joined: false,
      joinable: true,
    });
  });

  it('names a deleted host rather than showing an empty row', () => {
    // 0046 LEFT JOINs profiles: a deleted account costs the row its name, not
    // its place, the same rule rh_match_history uses for a gone opponent.
    expect(mapPartyInvite({...row, display_name: null}).profile.displayName).toBe(
      'Someone',
    );
  });

  it('never claims joinable when already joined', () => {
    expect(mapPartyInvite({...row, joined: true, joinable: true}).joinable).toBe(
      false,
    );
  });
});
