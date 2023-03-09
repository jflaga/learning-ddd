import { client, Empty, Operator, Policy } from "@rotorsoft/eventually";
import { reassignAgent } from "./services/agent";
import { Ticket } from "./ticket.aggregate";
import { ReassignmentCronTriggered } from "./ticket.event.schemas";
import { TicketProjection, Tickets } from "./ticket.projector";
import * as types from "./types";
import { rescheduleCronEvent } from "./utils";

const BATCH_SIZE = 10;

export const Reassingment = (): Policy<
  Pick<types.TicketCommands, "ReassignTicket">,
  { ReassignmentCronTriggered: Empty }
> => ({
  description: "Reassigns ticket after agent inactivity period",
  schemas: {
    events: { ReassignmentCronTriggered },
    commands: { ReassignTicket: "Reassigns ticket" },
  },
  on: {
    ReassignmentCronTriggered: () => {
      setImmediate(async () => {
        // load batch of tickets with expired agent response window
        const expired: Array<TicketProjection> = [];
        await client().read(
          Tickets,
          {
            where: {
              reassignAfter: { operator: Operator.lt, value: new Date() },
            },
            limit: BATCH_SIZE,
          },
          (p) => expired.push(p.state)
        );
        for (const ticket of expired) {
          const agent = await reassignAgent(ticket);
          await client().command(
            Ticket,
            "ReassignTicket",
            {
              ticketId: ticket.id,
              ...agent,
            },
            {
              id: ticket.id,
            }
          );
        }
        expired.length === BATCH_SIZE &&
          rescheduleCronEvent(Reassingment, "ReassignmentCronTriggered", 10);
      });
      return Promise.resolve(undefined);
    },
  },
});