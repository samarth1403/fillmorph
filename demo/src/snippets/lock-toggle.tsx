import { FillMorph } from "fillmorph/react";
import { FaLock, FaLockOpen } from "react-icons/fa6";

export const LockToggle = ({ locked }: { locked: boolean }) => {
  return (
    <FillMorph
      icon={
        locked ? <FaLock color="#f97316" size={56} /> : <FaLockOpen color="#10b981" size={56} />
      }
    />
  );
};
