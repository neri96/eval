import { useMemo, useState } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import { useShallow } from "zustand/react/shallow";
import { useEvalStore } from "@/store/evalStore";
import { type Ticket } from "@/shared/types";

import { selectTickets } from "@/store/selectors";

import styles from "./TicketList.module.css";

type TicketRow = {
  id: string;
  name: string;
  operators: string[];
  sessions: number;
  createdAt: number;
};

const columnHelper = createColumnHelper<TicketRow>();

const TicketList = () => {
  "use no memo";

  // selectTickets returns a freshly filtered array, so shallow-compare it
  // element-wise (wrapping it in an object would compare it by reference and
  // loop). sessions is a stable store reference.
  const tickets = useEvalStore(useShallow(selectTickets));
  const sessions = useEvalStore((state) => state.sessions);

  const [sorting, setSorting] = useState<SortingState>([
    { id: "createdAt", desc: true },
  ]);

  const data = useMemo<TicketRow[]>(() => {
    const sessionCountByTicket = sessions.reduce<Record<string, number>>(
      (acc, session) => {
        if (!session.ticketId) return acc;
        acc[session.ticketId] = (acc[session.ticketId] ?? 0) + 1;
        return acc;
      },
      {},
    );

    return tickets.map((ticket: Ticket) => ({
      id: ticket.id,
      name: ticket.name,
      operators: ticket.operators,
      sessions: sessionCountByTicket[ticket.id] ?? 0,
      createdAt: Date.parse(ticket.createdAt) || 0,
    }));
  }, [tickets, sessions]);

  const columns = useMemo(
    () => [
      columnHelper.accessor("name", {
        id: "name",
        header: "Ticket",
        cell: (info) => <span className={styles.name}>{info.getValue()}</span>,
      }),
      columnHelper.accessor((row) => row.operators.join(", "), {
        id: "operators",
        header: "Operators",
        cell: (info) => {
          const operators = info.row.original.operators;
          if (!operators.length) {
            return <span className={styles.muted}>—</span>;
          }
          return (
            <div className={styles.operators}>
              {operators.map((operator) => (
                <span key={operator} className={styles.chip}>
                  {operator}
                </span>
              ))}
            </div>
          );
        },
      }),
      columnHelper.accessor("sessions", {
        id: "sessions",
        header: "Sessions",
        cell: (info) => {
          const count = info.getValue();
          return (
            <span
              className={`${styles.sessions} ${
                count === 0 ? styles.sessionsZero : ""
              }`}
            >
              {count}
            </span>
          );
        },
      }),
      columnHelper.accessor("createdAt", {
        id: "createdAt",
        header: "Created",
        cell: (info) => (
          <span className={styles.created}>
            {new Date(info.getValue()).toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        ),
      }),
    ],
    [],
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const rows = table.getRowModel().rows;

  return (
    <div>
      <div className={styles.header}>
        <h1 className={styles.title}>Tickets</h1>
        <span className={styles.count}>
          {data.length} {data.length === 1 ? "ticket" : "tickets"}
        </span>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  return (
                    <th key={header.id}>
                      {header.isPlaceholder ? null : (
                        <button
                          type="button"
                          className={`${styles.headerButton} ${
                            sorted ? styles.sortActive : ""
                          }`}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                          <span className={styles.sortIcon}>
                            {sorted === "asc"
                              ? "\u25b2"
                              : sorted === "desc"
                                ? "\u25bc"
                                : ""}
                          </span>
                        </button>
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className={styles.empty} colSpan={columns.length}>
                  No tickets yet
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TicketList;
