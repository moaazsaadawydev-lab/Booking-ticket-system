-- KEYS: Array of lock keys (e.g., 'booking:lock:<showtimeId>:<seatId>')
-- ARGV[1]: userId
-- ARGV[2]: TTL in seconds (e.g., 600)

for i, key in ipairs(KEYS) do
    if redis.call('EXISTS', key) == 1 then
        return { 0, key } -- Collision detected, return conflicting key
    end
end

for i, key in ipairs(KEYS) do
    redis.call('SET', key, ARGV[1], 'EX', tonumber(ARGV[2]))
end

return { 1, 'OK' }
