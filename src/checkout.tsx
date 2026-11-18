import { Button } from "@ui-sdk/react/button"
import { Field, FieldDescription, FieldLabel } from "@ui-sdk/react/field"
import { Input } from "@ui-sdk/react/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ui-sdk/react/select"
import { Switch, SwitchThumb } from "@ui-sdk/react/switch"
import { useState } from "react"

const SUBTOTAL = 30
const GIFT_WRAP = 5
const AGENT_SHIPPING_CAP = 20
const shipping = [
  { value: "standard", label: "Standard", price: 0 },
  { value: "express", label: "Express", price: 15 },
  { value: "overnight", label: "Overnight", price: 40 },
]

const money = (amount: number) => (amount ? `$${amount}` : "Free")

function Checkout() {
  const [email, setEmail] = useState("")
  const [card, setCard] = useState("")
  const [method, setMethod] = useState("standard")
  const [giftWrap, setGiftWrap] = useState(false)
  const [status, setStatus] = useState("Not paid")

  const shippingPrice = shipping.find((s) => s.value === method)?.price ?? 0
  const total = SUBTOTAL + shippingPrice + (giftWrap ? GIFT_WRAP : 0)
  const last4 = card.replace(/\D/g, "").slice(-4) || "????"

  return (
    <main>
      <h1>Checkout</h1>
      <p className="product">
        <span>Ceramic mug set</span>
        <span>${SUBTOTAL}</span>
      </p>

      <div className="fields">
        <Field>
          <FieldLabel>Email</FieldLabel>
          <Input
            type="email"
            placeholder="you@example.com"
            value={email}
            onValueChange={(value) => setEmail(value)}
          />
        </Field>

        <Field>
          <FieldLabel>Card number</FieldLabel>
          <Input
            autoComplete="cc-number"
            inputMode="numeric"
            placeholder="1234 1234 1234 1234"
            value={card}
            onValueChange={(value) => setCard(value)}
          />
        </Field>

        <Field>
          <FieldLabel>Shipping</FieldLabel>
          <Select
            value={method}
            onValueChange={(value, details) => {
              const price = shipping.find((s) => s.value === value)?.price ?? 0
              if (details.source === "agent" && price > AGENT_SHIPPING_CAP) {
                details.cancel()
                return
              }
              if (value) setMethod(value)
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {shipping.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldDescription>
            Standard is free, Express $15, Overnight $40. Agents can't pick
            shipping over ${AGENT_SHIPPING_CAP}.
          </FieldDescription>
        </Field>

        <Field className="row">
          <FieldLabel>Gift wrap</FieldLabel>
          <Switch checked={giftWrap} onCheckedChange={(next) => setGiftWrap(next)}>
            <SwitchThumb />
          </Switch>
        </Field>
      </div>

      <div className="summary">
        <div>
          <span>Subtotal</span>
          <span>${SUBTOTAL}</span>
        </div>
        <div>
          <span>Shipping</span>
          <span>{money(shippingPrice)}</span>
        </div>
        {giftWrap && (
          <div>
            <span>Gift wrap</span>
            <span>${GIFT_WRAP}</span>
          </div>
        )}
        <p className="total" role="status" aria-label="Total">
          Total: ${total}
        </p>
      </div>

      <Button
        className="pay"
        data-variant="solid"
        data-agent-confirm={`Charges $${total} to the card ending ${last4}`}
        onClick={() => setStatus(`Paid $${total}`)}
      >
        Pay ${total}
      </Button>
      <p
        className="payment"
        role="status"
        aria-label="Payment"
        data-paid={status.startsWith("Paid") || undefined}
      >
        {status}
      </p>
    </main>
  )
}

export { Checkout }
