export class Timer {
  last: number;
  constructor() {
    this.last = performance.now();
  }

  tick() {
    let now = performance.now();
    let dt = (now - this.last) / 1000;
    this.last = now;
    return dt
  }

}
