// @ts-nocheck
/**
 * Helper to emit global balance updates via Socket.io.
 */
export function emitBalanceUpdate(storage: any, shopId?: number) {
    const io = (global as any).io;
    if (io) {
        storage.getMasterFloat(shopId).then((masterFloat: string) => {
            io.emit('global_balance_update', { masterFloat, shopId });
        });
    }
}

/**
 * Emit a Socket.io event to all connected clients.
 */
export function emitEvent(event: string, data: any) {
    const io = (global as any).io;
    if (io) {
        io.emit(event, data);
    }
}
