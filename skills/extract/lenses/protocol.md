# Lens: protocol

<!-- 렌즈 카드(16.3). trace run은 Scope, Trace, Pitfalls, Phrasing, Example을 받고, Checklist의 뜻은 필드 안내(L3)로 받는다. Review questions는 review run을 평가에 넣을 때 쓴다(결정 18). Example은 가상의 펌웨어로, 평가 시나리오와 겹치지 않게 쓴다. 14차 작업에서 점검표만 있던 카드에 절을 썼다(AI 결정 128). -->

## Scope

One link to a host or a peer device and its framing: how bytes are put together and sent, how received bytes become a message, the checksum or CRC, and what the code assumes about the other side.

## Trace

- `byte_assembly`: every place that builds a frame: header, length, addresses, payload order, byte order of each multi-byte field, padding, and the checksum position. Note which configurations build which frames.
- `crc_params`: for each checksum or CRC, every parameter the code fixes: width, polynomial, initial value, input and output reflection, final XOR, the bytes it covers, and the byte order it is sent in. Compute a known input when a parameter is only implied by a table.
- `rx_parser`: the receive path from the interrupt or DMA completion to a handled message: how a frame start and end are found, length checks, the checksum check, what happens to a bad frame, a short frame, an overlong frame and bytes that arrive mid-frame, and when the receiver resets.
- `struct_overlay`: structures cast over byte buffers, packed attributes, bit fields and unions; the layout they give depends on the compiler, the target and the packing, so note what the code relies on.
- `peer_assumption`: what the code expects of the other side: response times, retries it relies on, ordering, a maximum frame rate, a fixed address. These come from the code's waits and checks or from documents, not from the protocol name.

## Checklist

| ID | Meaning |
| --- | --- |
| `byte_assembly` | Code that assembles bytes |
| `crc_params` | Each CRC parameter |
| `rx_parser` | Receive parser |
| `struct_overlay` | Struct overlays on bytes (ABI dependent) |
| `peer_assumption` | Assumptions about the peer device |

## Pitfalls

- A protocol name in a comment does not fix its parameters; take every CRC parameter and field order from the code, and write a `conflicts` item when a document says otherwise.
- A table-driven CRC hides its polynomial and reflection; derive them from the table or a computed example and say how, or leave the parameter `unknown`.
- A structure overlay can differ between compilers and targets; record the layout as an observation for the configuration you checked and the dependency as an `impl_choices` or `constraints` item with the reason.
- A timeout that discards a partial frame is a quantity: give its chain or a `followups` unit with the timing lens.
- What the peer must do is a requirement on the peer only when the code shows it (a wait, a retry limit, a check); otherwise keep it as a `doc_claim` or an `unknowns` item.

## Phrasing

- Frame: "<구성>에서 <함수>가 <필드 차례>로 프레임을 만든다(바이트 순서: <빅/리틀>)." One frame type per item.
- CRC: "<이름>: 폭 <n>, 다항식 <0x..>, 초깃값 <0x..>, 입력·출력 반사 <예/아니오>, 마지막 XOR <0x..>, 범위 <어디부터 어디까지>."

## Example

```json
{
  "observations": [
    {
      "key": "o1",
      "text": "모든 구성에서 sensor_link_tx가 [시작 0x7E][길이][명령][데이터][CRC 하위][CRC 상위] 차례로 프레임을 만든다.",
      "configs": ["all"],
      "anchors": [
        { "kind": "code", "path": "link/sensor_link.c", "start": 61, "end": 66, "quote": "buf[n++] = crc & 0xFF; buf[n++] = crc >> 8;", "command": null }
      ],
      "inference": false
    },
    {
      "key": "o2",
      "text": "모든 구성에서 수신 길이가 버퍼보다 길면 sensor_link_rx가 그 프레임을 버리고 다음 시작 바이트를 기다린다.",
      "configs": ["all"],
      "anchors": [
        { "kind": "code", "path": "link/sensor_link.c", "start": 102, "end": 104, "quote": "if (len > LINK_MAX) { rx_state = RX_WAIT_START; }", "command": null }
      ],
      "inference": false
    }
  ],
  "quantities": [
    {
      "key": "q1",
      "symbol": "LINK_CRC_POLY",
      "expr": "0x1021",
      "values": [{ "configs": ["all"], "value": "0x1021" }],
      "unit": "",
      "unit_status": "unknown",
      "nature": "setting",
      "chain": [],
      "anchors": [
        { "kind": "code", "path": "link/crc16.c", "start": 8, "end": 8, "quote": "#define LINK_CRC_POLY 0x1021u", "command": null }
      ]
    }
  ],
  "checklist": {
    "byte_assembly": { "status": "covered", "refs": ["o1"], "searches": [] },
    "crc_params": { "status": "covered", "refs": ["q1"], "searches": [] },
    "rx_parser": { "status": "covered", "refs": ["o2"], "searches": [] }
  }
}
```
