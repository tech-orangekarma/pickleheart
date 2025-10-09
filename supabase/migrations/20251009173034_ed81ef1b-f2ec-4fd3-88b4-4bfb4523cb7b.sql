-- Add new mode to friend_finder_mode enum for receiving requests from everyone
ALTER TYPE friend_finder_mode ADD VALUE IF NOT EXISTS 'receive_all';

-- Update comment to reflect all available modes
COMMENT ON TYPE friend_finder_mode IS 'everyone: auto-friends with all users, auto_friends: auto-friends with people in range, auto_requests: send/receive requests in range, receive_all: receive requests from everyone, manual: no automatic actions';