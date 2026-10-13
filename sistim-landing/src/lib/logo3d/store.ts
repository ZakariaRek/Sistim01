// Tiny shared store between the form (writes) and the 3D logo (reads).
import { map } from 'nanostores';

export type ConsultStatus = 'form' | 'sending' | 'thanks' | 'error';

export interface ConsultState {
  /** Current form step, 0 to 3. */
  step: number;
  /** 1 = moving forward, -1 = going back. */
  direction: 1 | -1;
  /** Business type picked on step 1 (health, shop, architect, finance, freelancer, other). */
  businessType: string | null;
  status: ConsultStatus;
}

export const consultState = map<ConsultState>({ step: 0, direction: 1, businessType: null, status: 'form' });
