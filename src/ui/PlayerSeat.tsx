import type { PlayerState } from '../engine/types';
import './PlayerSeat.css';

interface PlayerSeatProps {
  player: PlayerState;
  isActing: boolean;
  isMe: boolean;
  wonAmount?: number;
}

export function PlayerSeat({ player, isActing, isMe, wonAmount }: PlayerSeatProps) {
  return (
    <div className={`player-seat ${isActing ? 'acting' : ''} ${player.status === 'folded' ? 'folded' : ''}`}>
      <div className="player-name">
        {player.name}
        {isMe ? ' (you)' : ''}
        {player.isHost ? ' 👑' : ''}
      </div>
      <div className="player-stack">{player.stack}</div>
      {player.bet > 0 && <div className="player-bet">bet {player.bet}</div>}
      {player.status === 'all-in' && <div className="player-status">ALL IN</div>}
      {player.status === 'folded' && <div className="player-status">folded</div>}
      {wonAmount ? <div className="player-won">+{wonAmount}</div> : null}
    </div>
  );
}
