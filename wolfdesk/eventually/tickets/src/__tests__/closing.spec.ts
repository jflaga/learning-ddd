import { app, client, dispose } from "@rotorsoft/eventually";
import { Ticket } from "../ticket.aggregate";
import { Chance } from "chance";
import { openTicket } from "./commands";
import { Closing } from "../closing.policy";

const chance = new Chance();

describe("closing policy", () => {
  beforeAll(() => {
    app().with(Ticket).with(Closing).build();
  });

  afterAll(async () => {
    await dispose()();
  });

  it("should request escalation", async () => {
    const ticketId = chance.guid();
    await openTicket(ticketId, "assign me", "Opening a new ticket");
    await client().event(Closing, {
      name: "CheckInactiveTicketsCronTriggered",
      data: {},
      id: 0,
      stream: "",
      version: 0,
      created: new Date(),
      metadata: { correlation: "", causation: {} },
    });
    const snapshot = await client().load(Ticket, ticketId);
    expect(snapshot.state.closedById).toBeDefined();
  });
});
