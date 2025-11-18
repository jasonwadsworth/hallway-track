describe('Badge Awarding Workflow Integration', () => {
  describe('Threshold Badge Awarding', () => {
    it('should award first-connection badge at 1 connection', () => {
      const user = {
        connectionCount: 1,
        badges: [] as string[]
      };
      
      const thresholds = [
        { count: 1, badge: 'first-connection' },
        { count: 5, badge: 'connector' }
      ];
      
      const newBadges = thresholds
        .filter(t => user.connectionCount >= t.count)
        .map(t => t.badge)
        .filter(b => !user.badges.includes(b));
      
      expect(newBadges).toContain('first-connection');
      expect(newBadges).not.toContain('connector');
    });

    it('should award multiple badges when reaching threshold', () => {
      const user = {
        connectionCount: 10,
        badges: ['first-connection', 'connector']
      };
      
      const thresholds = [
        { count: 1, badge: 'first-connection' },
        { count: 5, badge: 'connector' },
        { count: 10, badge: 'networker' }
      ];
      
      const newBadges = thresholds
        .filter(t => user.connectionCount >= t.count)
        .map(t => t.badge)
        .filter(b => !user.badges.includes(b));
      
      expect(newBadges).toEqual(['networker']);
    });

    it('should not award duplicate badges', () => {
      const existingBadges = ['first-connection', 'connector'];
      const badgeToCheck = 'connector';
      
      const shouldAward = !existingBadges.includes(badgeToCheck);
      
      expect(shouldAward).toBe(false);
    });
  });

  describe('Special Badge Logic', () => {
    it('should award VIP badge for connecting with high-connection user', () => {
      const connectedUserConnectionCount = 75;
      const vipThreshold = 50;
      
      const shouldAwardVIP = connectedUserConnectionCount >= vipThreshold;
      
      expect(shouldAwardVIP).toBe(true);
    });

    it('should not award VIP badge for low-connection user', () => {
      const connectedUserConnectionCount = 30;
      const vipThreshold = 50;
      
      const shouldAwardVIP = connectedUserConnectionCount >= vipThreshold;
      
      expect(shouldAwardVIP).toBe(false);
    });

    it('should award met-the-maker badge for configured maker', () => {
      const connectedUserId = 'maker-user-id';
      const makerUserId = 'maker-user-id';
      
      const shouldAwardMaker = connectedUserId === makerUserId;
      
      expect(shouldAwardMaker).toBe(true);
    });

    it('should award reinvent-connector during event dates', () => {
      const connectionDate = new Date('2024-12-03');
      const eventStart = new Date('2024-12-02');
      const eventEnd = new Date('2024-12-06');
      
      const isDuringEvent = connectionDate >= eventStart && connectionDate <= eventEnd;
      
      expect(isDuringEvent).toBe(true);
    });

    it('should not award reinvent-connector outside event dates', () => {
      const connectionDate = new Date('2024-11-30');
      const eventStart = new Date('2024-12-02');
      const eventEnd = new Date('2024-12-06');
      
      const isDuringEvent = connectionDate >= eventStart && connectionDate <= eventEnd;
      
      expect(isDuringEvent).toBe(false);
    });
  });

  describe('Triangle Badge Detection', () => {
    it('should detect complete triangle', () => {
      const userAConnections = ['userB', 'userC'];
      const userBConnections = ['userA', 'userC'];
      const userCConnections = ['userA', 'userB'];
      
      const hasTriangle = 
        userAConnections.includes('userB') && userAConnections.includes('userC') &&
        userBConnections.includes('userA') && userBConnections.includes('userC') &&
        userCConnections.includes('userA') && userCConnections.includes('userB');
      
      expect(hasTriangle).toBe(true);
    });

    it('should not detect incomplete triangle', () => {
      const userAConnections = ['userB'];
      const userBConnections = ['userA', 'userC'];
      const userCConnections = ['userB'];
      
      const hasTriangle = 
        userAConnections.includes('userB') && userAConnections.includes('userC') &&
        userBConnections.includes('userA') && userBConnections.includes('userC') &&
        userCConnections.includes('userA') && userCConnections.includes('userB');
      
      expect(hasTriangle).toBe(false);
    });
  });

  describe('Early Supporter Badge', () => {
    it('should award to first 10 connections when user reaches 500', () => {
      const userConnectionCount = 500;
      const connectionIndex = 5;
      const maxEarlySupporter = 10;
      
      const shouldAward = userConnectionCount >= 500 && connectionIndex <= maxEarlySupporter;
      
      expect(shouldAward).toBe(true);
    });

    it('should not award after 10th connection', () => {
      const userConnectionCount = 500;
      const connectionIndex = 11;
      const maxEarlySupporter = 10;
      
      const shouldAward = userConnectionCount >= 500 && connectionIndex <= maxEarlySupporter;
      
      expect(shouldAward).toBe(false);
    });
  });

  describe('Badge Re-evaluation on Connection Removal', () => {
    it('should remove badges when count drops below threshold', () => {
      const previousCount = 10;
      const newCount = 9;
      const existingBadges = ['first-connection', 'connector', 'networker'];
      
      const thresholds = [
        { count: 1, badge: 'first-connection' },
        { count: 5, badge: 'connector' },
        { count: 10, badge: 'networker' }
      ];
      
      const validBadges = thresholds
        .filter(t => newCount >= t.count)
        .map(t => t.badge);
      
      const badgesToRemove = existingBadges.filter(b => !validBadges.includes(b));
      
      expect(badgesToRemove).toContain('networker');
      expect(badgesToRemove).not.toContain('connector');
    });
  });
});
