// Server time, and a demo control to lie about the device clock.
//
// Firebase tells every client the delta between this device's clock and the
// server's clock through the special ".info/serverTimeOffset" node. We render
// the countdown from server time, so even a phone with a wrong clock shows the
// right timer.
//
// The "skew" here is a demo lever. It does NOT change the real OS clock. It
// changes the time the app CLAIMS when it submits an answer (clientSubmitAt).
// That is exactly the value the server ignores. Proof 2 is: move this slider to
// +30s or -30s, answer, and your score does not budge, because the Cloud
// Function scores on the server's own timestamp, never on what the phone claimed.

import { useEffect, useRef, useState, useCallback } from 'react';
import { onValue, ref } from 'firebase/database';
import { db } from './firebase';

export function useServerTime() {
  const [serverOffset, setServerOffset] = useState(0);
  const [skewMs, setSkewMs] = useState(0);
  const skewRef = useRef(0);

  useEffect(() => {
    const offRef = ref(db, '.info/serverTimeOffset');
    return onValue(offRef, (snap) => {
      setServerOffset(snap.val() || 0);
    });
  }, []);

  const setSkew = useCallback((ms: number) => {
    skewRef.current = ms;
    setSkewMs(ms);
  }, []);

  // The true server clock, corrected for this device's real offset.
  const serverNow = useCallback(() => Date.now() + serverOffset, [serverOffset]);

  // The clock the phone THINKS it has, once the demo skew is applied. This is
  // what we stamp onto clientSubmitAt to prove the server ignores it.
  const deviceNow = useCallback(() => Date.now() + skewRef.current, []);

  return { serverOffset, skewMs, setSkew, serverNow, deviceNow };
}
