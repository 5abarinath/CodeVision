// ABOUTME: Renders user initials inside a deterministically colored circle avatar.
// ABOUTME: Color is derived from a hash of the user's name; falls back to email initial if name is empty.

const AVATAR_COLORS = ['#7C3AED', '#2563EB', '#0D9488', '#16A34A', '#4F46E5', '#0891B2'];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function getInitials(firstName: string, lastName: string | null, email: string): string {
  if (firstName) {
    return (firstName[0] + (lastName ? lastName[0] : '')).toUpperCase();
  }
  return email[0].toUpperCase();
}

interface InitialsAvatarProps {
  firstName: string;
  lastName: string | null;
  email: string;
  size: number;
}

export default function InitialsAvatar({ firstName, lastName, email, size }: InitialsAvatarProps) {
  const initials = getInitials(firstName, lastName, email);
  const color = AVATAR_COLORS[hashString(firstName + (lastName ?? '')) % AVATAR_COLORS.length];

  return (
    <div
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: Math.floor(size * 0.4),
        fontWeight: 600,
        color: '#fff',
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      {initials}
    </div>
  );
}
