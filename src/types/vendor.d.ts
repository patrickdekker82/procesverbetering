// Minimal declarations for libraries that ship without types for their main entry.

declare module 'bpmn-moddle' {
  /** Any element read by moddle; properties depend on `$type` (e.g. 'bpmn:Task'). */
  export interface ModdleElement {
    $type: string;
    id?: string;
    name?: string;
    [key: string]: unknown;
  }

  export interface FromXmlResult {
    rootElement: ModdleElement;
    warnings: Array<{ message: string }>;
  }

  export class BpmnModdle {
    constructor();
    fromXML(xml: string): Promise<FromXmlResult>;
  }
}

declare module 'mammoth' {
  interface Input {
    arrayBuffer?: ArrayBuffer;
    buffer?: Uint8Array;
  }
  export function extractRawText(input: Input): Promise<{ value: string; messages: unknown[] }>;
  const mammoth: { extractRawText: typeof extractRawText };
  export default mammoth;
}
