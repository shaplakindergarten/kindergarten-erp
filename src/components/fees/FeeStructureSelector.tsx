import { useState, useMemo } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, Loader2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface FeeStructure {
  id: string;
  name: string;
  total_amount: number;
  is_active: boolean;
  academic_year_id: string;
  class_id: string;
  academic_year?: { id: string; year_name: string };
  class?: { id: string; name: string };
  items?: {
    id: string;
    category_id: string;
    amount: number;
    frequency: string;
    name: string;
    fee_category?: { id: string; name: string; description: string | null };
  }[];
}

interface FeeStructureSelectorProps {
  structures: FeeStructure[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function FeeStructureSelector({
  structures,
  value,
  onChange,
  disabled = false,
  placeholder = 'Select fee structure...',
}: FeeStructureSelectorProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [selectedStructure, setSelectedStructure] = useState<FeeStructure | null>(null);

  const selected = useMemo(() => {
    return structures.find((s) => s.id === value);
  }, [structures, value]);

  const handleSelect = (id: string) => {
    onChange(id);
    const structure = structures.find((s) => s.id === id);
    setSelectedStructure(structure || null);
  };

  const handlePreview = (structureId: string) => {
    const structure = structures.find((s) => s.id === structureId);
    setSelectedStructure(structure || null);
    setPreviewOpen(true);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Select value={value} onValueChange={handleSelect} disabled={disabled}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {structures.map((structure) => (
              <SelectItem key={structure.id} value={structure.id}>
                <div className="flex items-center justify-between w-full gap-4">
                  <span className="font-medium">{structure.name}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {formatCurrency(structure.total_amount)}
                    </Badge>
                    {structure.is_active ? (
                      <Badge className="bg-emerald-500 text-white text-[10px] px-1.5">
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px] px-1.5">
                        Inactive
                      </Badge>
                    )}
                  </div>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selected && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handlePreview(selected.id)}
            className="shrink-0"
          >
            <Eye className="h-4 w-4 mr-1" />
            Preview
          </Button>
        )}
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Fee Structure Preview</DialogTitle>
          </DialogHeader>
          {selectedStructure && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">{selectedStructure.name}</h3>
                  {selectedStructure.academic_year && (
                    <p className="text-sm text-muted-foreground">
                      Academic Year: {selectedStructure.academic_year.year_name}
                    </p>
                  )}
                  {selectedStructure.class && (
                    <p className="text-sm text-muted-foreground">
                      Class: {selectedStructure.class.name}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(selectedStructure.total_amount)}
                  </p>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-2 text-left">Category</th>
                      <th className="px-4 py-2 text-left">Frequency</th>
                      <th className="px-4 py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedStructure.items || []).map((item) => (
                      <tr key={item.id} className="border-t">
                        <td className="px-4 py-2">{item.fee_category?.name || item.name}</td>
                        <td className="px-4 py-2">
                          <Badge variant="outline" className="text-xs">
                            {item.frequency}
                          </Badge>
                        </td>
                        <td className="px-4 py-2 text-right font-medium">
                          {formatCurrency(item.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-muted/20 border-t">
                    <tr>
                      <td colSpan={2} className="px-4 py-2 font-semibold text-right">
                        Total
                      </td>
                      <td className="px-4 py-2 font-bold text-right text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(selectedStructure.total_amount)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {selectedStructure.description && (
                <p className="text-sm text-muted-foreground">
                  {selectedStructure.description}
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}