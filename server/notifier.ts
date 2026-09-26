type Listener = () => void;

export interface Notifier {
  publish(code: string): void;
  subscribe(code: string, listener: Listener): () => void;
  listeners(code: string): number;
  activeCodes(): string[];
}

export class LocalNotifier implements Notifier {
  private channels = new Map<string, Set<Listener>>();

  publish(code: string) {
    this.channels.get(code)?.forEach((listener) => listener());
  }

  subscribe(code: string, listener: Listener): () => void {
    const channel = this.channels.get(code) ?? new Set();
    channel.add(listener);
    this.channels.set(code, channel);
    return () => {
      channel.delete(listener);
      if (channel.size === 0) {
        this.channels.delete(code);
      }
    };
  }

  listeners(code: string): number {
    return this.channels.get(code)?.size ?? 0;
  }

  activeCodes(): string[] {
    return [...this.channels.keys()];
  }
}
