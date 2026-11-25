declare module 'gi://Adw' {
  const Adw: any;
  export default Adw;
}

declare module 'gi://Clutter' {
  const Clutter: {
    ActorAlign: {
      START: unknown;
      CENTER: unknown;
      END: unknown;
      FILL: unknown;
    };
    Orientation: {
      HORIZONTAL: number;
      VERTICAL: number;
    };
    AnimationMode: {
      LINEAR: number;
      EASE_OUT_QUAD: number;
      EASE_OUT_CUBIC: number;
    };
    CursorType?: {
      DEFAULT: number;
      GRAB: number;
      GRABBING: number;
      POINTER: number;
      E_RESIZE: number;
      W_RESIZE: number;
      EW_RESIZE: number;
    };
    EventType: {
      KEY_PRESS: number;
      MOTION: number;
      BUTTON_PRESS: number;
      BUTTON_RELEASE: number;
      TOUCH_END: number;
      TOUCH_CANCEL: number;
    };
    ModifierType: {
      BUTTON1_MASK: number;
    };
    KEY_Escape: number;
    BUTTON_PRIMARY: number;
    EVENT_PROPAGATE: boolean;
    EVENT_STOP: boolean;
    PropertyTransition: new (config: {
      property_name: string;
      duration?: number;
      repeat_count?: number;
      progress_mode?: number;
    }) => {
      set_from(value: unknown): void;
      set_to(value: unknown): void;
      start(): void;
      pause(): void;
      stop(): void;
      is_playing(): boolean;
    };
    ClickGesture?: new () => {
      connect(signal: string, callback: (...args: any[]) => any): number;
    };
  };
  export default Clutter;
}

declare module 'gi://Gio' {
  const Gio: any;
  export default Gio;
}

declare module 'gi://GLib' {
  const GLib: any;
  export default GLib;
}

declare module 'gi://GObject' {
  const GObject: {
    registerClass<T>(klass: T): T;
  };
  export default GObject;
}

declare module 'gi://Gdk' {
  export class RGBA {
    red: number;
    green: number;
    blue: number;
    alpha: number;

    parse(input: string): boolean;
  }

  const Gdk: {
    RGBA: typeof RGBA;
  };
  export default Gdk;
}

declare module 'gi://Gtk' {
  const Gtk: any;
  export default Gtk;
}

declare module 'gi://Meta' {
  const Meta: {
    KeyBindingFlags: {
      NONE: number;
      IGNORE_AUTOREPEAT: number;
    };
    Cursor?: {
      DEFAULT: number;
      MOVE_OR_RESIZE_WINDOW?: number;
      DND_MOVE?: number;
    };
  };
  export default Meta;
}

declare module 'gi://Pango' {
  const Pango: {
    EllipsizeMode: {
      END: unknown;
      NONE: unknown;
    };
    Alignment: {
      LEFT: unknown;
      CENTER: unknown;
      RIGHT: unknown;
    };
    WrapMode: {
      WORD_CHAR: unknown;
    };
  };
  export default Pango;
}

declare module 'gi://Shell' {
  const Shell: {
    ActionMode: {
      NORMAL: number;
      OVERVIEW: number;
    };
  };
  export default Shell;
}

declare module 'gi://Soup' {
  const Soup: any;
  export default Soup;
}

declare module 'gi://St' {
  export class Widget {
    visible: boolean;
    reactive: boolean;
    x: number;
    y: number;
    width: number;
    height: number;
    opacity: number;
    translation_y: number;
    rotation_angle_z: number;
    clip_to_allocation: boolean;
    x_expand: boolean;
    y_expand: boolean;
    x_align: unknown;
    y_align: unknown;
    style: string;
    constructor(config?: Record<string, unknown>);
    add_style_class_name(name: string): void;
    remove_style_class_name(name: string): void;
    contains(descendant: unknown): boolean;
    set_position(x: number, y: number): void;
    set_width(width: number): void;
    set_height(height: number): void;
    get_width(): number;
    get_transformed_position(): [number, number];
    add_child(actor: unknown): void;
    set_pivot_point(x: number, y: number): void;
    set_cursor_type?(cursorType: number): void;
    set_style(style: string): void;
    get_preferred_size(): [number, number, number, number];
    add_transition(name: string, transition: unknown): void;
    get_transition(name: string): any;
    remove_transition(name: string): void;
    remove_all_transitions(): void;
    ease(params: Record<string, unknown>): void;
    connect(signal: string, callback: (...args: any[]) => any): number;
    disconnect(id: number): void;
    queue_relayout(): void;
    destroy(): void;
  }

  export class Bin extends Widget {
    constructor(config?: {
      style_class?: string;
      y_align?: unknown;
      x_align?: unknown;
      x_expand?: boolean;
      y_expand?: boolean;
      clip_to_allocation?: boolean;
    });
    set_child(actor: unknown): void;
  }

  export class Button extends Widget {
    constructor(config?: {
      style_class?: string;
      reactive?: boolean;
      can_focus?: boolean;
      track_hover?: boolean;
      y_align?: unknown;
      x_align?: unknown;
      child?: unknown;
      accessible_name?: string;
    });
    set_child(actor: unknown): void;
  }

  export class BoxLayout extends Widget {
    constructor(config?: {
      style_class?: string;
      reactive?: boolean;
      can_focus?: boolean;
      track_hover?: boolean;
      x_expand?: boolean;
      y_expand?: boolean;
      x_align?: unknown;
      y_align?: unknown;
      clip_to_allocation?: boolean;
    });
    _init(config?: Record<string, unknown>): void;
    add_child(actor: unknown): void;
    set_orientation?(orientation: number): void;
    set_vertical?(vertical: boolean): void;
  }

  export class Label extends Widget {
    constructor(config: {
      text: string;
      y_align?: unknown;
      x_align?: unknown;
      x_expand?: boolean;
      style_class?: string;
    });
    text: string;
    clutter_text: any;
    set_text(text: string): void;
  }

  export class Icon extends Widget {
    icon_name: string;
    constructor(config?: {
      gicon?: unknown;
      icon_name?: string;
      icon_size?: number;
      style_class?: string;
    });
  }

  const St: {
    Widget: typeof Widget;
    Bin: typeof Bin;
    Button: typeof Button;
    BoxLayout: typeof BoxLayout;
    Label: typeof Label;
    Icon: typeof Icon;
  };
  export default St;
}

declare module 'resource:///org/gnome/shell/extensions/extension.js' {
  export class Extension {
    uuid: string;
    getSettings(schema?: string): any;
    openPreferences(): void;
  }
}

declare module 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js' {
  export class ExtensionPreferences {
    getSettings(schema?: string): any;
  }
}

declare module 'resource:///org/gnome/shell/ui/main.js' {
  export const panel: {
    addToStatusArea(
      role: string,
      indicator: unknown,
      position?: number,
      box?: 'left' | 'center' | 'right',
    ): void;
  };

  export const layoutManager: {
    uiGroup: {
      add_child(actor: unknown): void;
      remove_child(actor: unknown): void;
    };
    monitors: Array<{ x: number; y: number; width: number; height: number }>;
    primaryIndex: number;
    getWorkAreaForMonitor(index: number): { x: number; y: number; width: number; height: number };
    trackChrome(
      actor: unknown,
      params?: { affectsInputRegion?: boolean; trackFullscreen?: boolean },
    ): void;
    untrackChrome(actor: unknown): void;
    connect(signal: string, callback: (...args: any[]) => any): number;
    disconnect(id: number): void;
  };

  export const overview: {
    visible: boolean;
    connect(signal: string, callback: (...args: any[]) => any): number;
    disconnect(id: number): void;
  };

  export const wm: {
    addKeybinding(
      name: string,
      settings: any,
      flags: number,
      modes: number,
      handler: () => void,
    ): void;
    removeKeybinding(name: string): void;
  };

  export function pushModal(actor: unknown, params?: { actionMode?: number }): any;
  export function popModal(grab: unknown): void;
}

declare module 'resource:///org/gnome/shell/ui/panelMenu.js' {
  export class Button {
    menu: any;
    label_actor: unknown;
    visible: boolean;
    constructor(menuAlignment?: number, nameText?: string | null, dontCreateMenu?: boolean);
    _init(menuAlignment: number, nameText?: string | null, dontCreateMenu?: boolean): void;
    add_action(action: unknown): void;
    remove_action(action: unknown): void;
    add_child(actor: unknown): void;
    add_style_class_name(name: string): void;
    destroy(): void;
    connect(signal: string, callback: (...args: any[]) => any): number;
    disconnect(id: number): void;
  }
}

declare module 'resource:///org/gnome/shell/ui/popupMenu.js' {
  export enum Ornament {
    NONE = 0,
    DOT = 1,
    CHECK = 2,
    HIDDEN = 3,
  }
  export class PopupMenu {
    addMenuItem(item: unknown, position?: number): void;
  }
  export class PopupBaseMenuItem {
    setOrnament(ornament: Ornament): void;
    setSensitive(sensitive: boolean): void;
  }
  export class PopupMenuItem extends PopupBaseMenuItem {
    constructor(text: string, params?: unknown);
    connect(signal: 'activate', callback: () => void): number;
    disconnect(id: number): void;
  }
  export class PopupSubMenuMenuItem extends PopupBaseMenuItem {
    menu: PopupMenu;
    label?: { text: string };
    constructor(text: string, wantsIcon?: boolean);
  }
  export class PopupSwitchMenuItem extends PopupBaseMenuItem {
    constructor(text: string, active: boolean, params?: unknown);
    connect(signal: 'toggled', callback: (item: unknown, active: boolean) => void): number;
    disconnect(id: number): void;
    setToggleState(active: boolean): void;
  }
  export class PopupSeparatorMenuItem {
    constructor();
  }
}

declare const global: {
  stage: {
    grab(actor: unknown): { dismiss(): void };
    connect(signal: string, callback: (...args: any[]) => any): number;
    disconnect(id: number): void;
  };
  display: {
    get_monitor_in_fullscreen(monitorIndex: number): boolean;
    connect(signal: string, callback: (...args: any[]) => any): number;
    disconnect(id: number): void;
  };
};
