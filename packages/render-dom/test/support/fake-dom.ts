export class FakeDocument {
  createElement(tag: string): FakeElement {
    return new FakeElement(tag, this);
  }
}

export class FakeStyle {
  private readonly values = new Map<string, string>();

  setProperty(name: string, value: string): void {
    this.values.set(name, value);
  }

  toJSON(): Record<string, string> {
    return Object.fromEntries(this.values.entries());
  }
}

export class FakeElement {
  readonly style = new FakeStyle();
  readonly children: FakeElement[] = [];
  readonly ownerDocument: FakeDocument;
  textContent: string | null = null;
  tabIndex = -1;

  private readonly listeners = new Map<
    string,
    Array<(event: unknown) => void>
  >();
  private boundingRect = { left: 0, top: 0 };
  private childBoundingOrigin = { left: 0, top: 0 };

  constructor(
    readonly tag: string,
    ownerDocument: FakeDocument,
  ) {
    this.ownerDocument = ownerDocument;
  }

  replaceChildren(...children: FakeElement[]): void {
    this.children.length = 0;
    this.children.push(...children);

    for (const child of children) {
      child.setBoundingClientRect(
        this.childBoundingOrigin.left,
        this.childBoundingOrigin.top,
      );
    }
  }

  appendChild(child: FakeElement): void {
    this.children.push(child);
    child.setBoundingClientRect(
      this.childBoundingOrigin.left,
      this.childBoundingOrigin.top,
    );
  }

  addEventListener(type: string, listener: (event: unknown) => void): void {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: (event: unknown) => void): void {
    const listeners = this.listeners.get(type);
    if (listeners === undefined) {
      return;
    }

    this.listeners.set(
      type,
      listeners.filter((current) => current !== listener),
    );
  }

  getBoundingClientRect(): { left: number; top: number } {
    return { ...this.boundingRect };
  }

  setBoundingClientRect(left: number, top: number): void {
    this.boundingRect = { left, top };
  }

  setChildBoundingOrigin(left: number, top: number): void {
    this.childBoundingOrigin = { left, top };
  }

  focus(): void {}

  emit(type: string, event: unknown): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }
}
