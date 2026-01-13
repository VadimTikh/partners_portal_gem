'use client';

import { useEffect, useState, ChangeEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, Trash2, Plus, Upload, Lock, Pencil } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';
import { CourseDate } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useI18n } from '@/lib/i18n';

const courseSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  sku: z.string().optional(), // SKU is auto-generated, not required from partner
  location: z.string().min(1, 'Location is required'),
  description: z.string().min(1, 'Description is required'),
  basePrice: z.number().min(0, 'Price must be positive'),
  status: z.enum(['active', 'inactive']),
  image: z.string().optional(),
});

type CourseFormValues = z.infer<typeof courseSchema>;

// Parse datetime string without timezone conversion (treat as local time)
const parseAsLocalTime = (dateTimeStr: string) => {
  // Remove Z suffix to prevent UTC conversion
  return new Date(dateTimeStr.replace('Z', ''));
};

export default function EditorPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const isNew = id === 'new';
  const queryClient = useQueryClient();
  const { t } = useI18n();

  const [isAddDateDialogOpen, setIsAddDateDialogOpen] = useState(false);
  const [newDateForm, setNewDateForm] = useState({
    dateTime: new Date(),
    capacity: 10,
    duration: 180,
    price: 0,
  });
  const [editingPriceId, setEditingPriceId] = useState<number | null>(null);
  const [editedPrice, setEditedPrice] = useState<number>(0);
  const [editingSeatsId, setEditingSeatsId] = useState<number | null>(null);
  const [editedSeats, setEditedSeats] = useState<number>(0);
  const hasHydrated = useAuthStore((state) => state._hasHydrated);

  const { data: course, isLoading: isCourseLoading } = useQuery({
    queryKey: ['course', id],
    queryFn: () => api.getCourse(id),
    enabled: hasHydrated && !!id && !isNew,
  });

  const { data: existingDates, isLoading: isDatesLoading } = useQuery({
    queryKey: ['dates', id],
    queryFn: () => api.getDates(id),
    enabled: hasHydrated && !!id && !isNew,
  });

  const form = useForm<CourseFormValues>({
    resolver: zodResolver(courseSchema),
    defaultValues: {
      title: '',
      sku: '',
      location: '',
      description: '',
      basePrice: 0,
      status: 'active',
      image: 'https://images.unsplash.com/photo-1556910103-1c02745a30bf',
    },
  });

  useEffect(() => {
    if (course) {
      form.reset({
        title: course.title,
        sku: course.sku,
        location: course.location,
        description: course.description,
        basePrice: course.basePrice,
        status: course.status,
        image: course.image,
      });
    }
  }, [course, form]);

  const updateCourseMutation = useMutation({
    mutationFn: api.updateCourse,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      queryClient.invalidateQueries({ queryKey: ['course', id] });
    },
  });

  const createCourseMutation = useMutation({
    mutationFn: api.createCourse,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses'] });
    },
  });

  const createDateMutation = useMutation({
    mutationFn: api.createDate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dates', id] });
    },
  });

  const deleteDateMutation = useMutation({
    mutationFn: api.deleteDate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dates', id] });
    },
  });

  const updateDateMutation = useMutation({
    mutationFn: ({ dateId, price }: { dateId: number; price: number }) => api.updateDate(dateId, price),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dates', id] });
    },
  });

  const updateSeatsMutation = useMutation({
    mutationFn: ({ dateId, seats }: { dateId: number; seats: number }) => api.updateSeats(dateId, seats),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dates', id] });
    },
  });

  const onSubmit = async (data: CourseFormValues) => {
    try {
      if (isNew) {
        const newCourse = await createCourseMutation.mutateAsync({
          title: data.title,
          sku: data.sku || `NEW-${Date.now()}`, // Auto-generate SKU if not provided
          location: data.location,
          description: data.description,
          basePrice: data.basePrice,
          status: data.status,
          image: data.image || '',
        });
        toast.success(t.editor.successSaved);
        // Navigate to the edit page of the newly created course to add dates
        router.push(`/dashboard/editor/${newCourse.id}`);
      } else {
        await updateCourseMutation.mutateAsync({
          id: Number(id),
          title: data.title,
          status: data.status,
          basePrice: data.basePrice,
        });
        toast.success(t.editor.successSaved);
      }
    } catch (error) {
      toast.error(t.editor.failedSave);
      console.error(error);
    }
  };

  const handleAddDate = async () => {
    if (isNew) {
      toast.error('Please save the course first before adding dates');
      return;
    }

    const minDate = new Date();
    minDate.setDate(minDate.getDate() + 2);
    minDate.setHours(0, 0, 0, 0);

    if (newDateForm.dateTime < minDate) {
      toast.error(`Date must be at least 2 days in the future (from ${format(minDate, 'PPP')})`);
      return;
    }

    try {
      await createDateMutation.mutateAsync({
        courseId: Number(id),
        dateTime: format(newDateForm.dateTime, "yyyy-MM-dd'T'HH:mm:ss"),
        capacity: newDateForm.capacity,
        duration: newDateForm.duration,
        price: newDateForm.price,
      });
      setIsAddDateDialogOpen(false);
      
      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + 2);

      setNewDateForm({
        dateTime: nextDate,
        capacity: 10,
        duration: 180,
        price: course?.basePrice || 0,
      });
      toast.success('Date added successfully');
    } catch (error) {
      toast.error('Failed to add date');
      console.error(error);
    }
  };

  const handleRemoveDate = async (dateId: number) => {
    try {
      await deleteDateMutation.mutateAsync(dateId);
      toast.success('Date deleted successfully');
    } catch (error) {
      toast.error('Failed to delete date');
      console.error(error);
    }
  };

  const handleUpdatePrice = async (dateId: number, price: number) => {
    try {
      await updateDateMutation.mutateAsync({ dateId, price });
      setEditingPriceId(null);
      toast.success('Price updated successfully');
    } catch (error) {
      toast.error('Failed to update price');
      console.error(error);
    }
  };

  const startEditingPrice = (dateId: number, currentPrice: number) => {
    setEditingPriceId(dateId);
    setEditedPrice(currentPrice);
  };

  const handleUpdateSeats = async (dateId: number, seats: number) => {
    try {
      await updateSeatsMutation.mutateAsync({ dateId, seats });
      setEditingSeatsId(null);
      toast.success('Seats updated successfully');
    } catch (error) {
      toast.error('Failed to update seats');
      console.error(error);
    }
  };

  const startEditingSeats = (dateId: number, currentSeats: number) => {
    setEditingSeatsId(dateId);
    setEditedSeats(currentSeats);
  };

  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        form.setValue('image', reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  if (!isNew && (isCourseLoading || isDatesLoading)) {
    return <div className="p-8">{t.common.loading}</div>;
  }

  const dates = existingDates || [];

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-primary">
          {isNew ? t.editor.createTitle : t.editor.editTitle}
        </h1>
        <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.back()}>{t.common.cancel}</Button>
            <Button onClick={form.handleSubmit(onSubmit)} disabled={form.formState.isSubmitting || updateCourseMutation.isPending || createCourseMutation.isPending}>
            {form.formState.isSubmitting ? t.editor.saving : t.editor.saveChanges}
            </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>{t.editor.courseInfo}</CardTitle>
                    <CardDescription>{t.editor.courseInfoDesc}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-2">
                        <Label htmlFor="title">{t.editor.titleLabel}</Label>
                        <Input id="title" {...form.register('title')} />
                        {form.formState.errors.title && <p className="text-sm text-destructive">{form.formState.errors.title.message}</p>}
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="basePrice">{t.editor.priceLabel}</Label>
                        <Input id="basePrice" type="number" step="0.01" {...form.register('basePrice', { valueAsNumber: true })} />
                         {form.formState.errors.basePrice && <p className="text-sm text-destructive">{form.formState.errors.basePrice.message}</p>}
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="status">{t.editor.statusLabel}</Label>
                        <Select
                            onValueChange={(value) => form.setValue('status', value as 'active' | 'inactive')}
                            defaultValue={form.getValues('status')}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder={t.editor.selectStatus} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="active">{t.common.active}</SelectItem>
                                <SelectItem value="inactive">{t.common.inactive}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    {/* SKU field - only show for existing courses (read-only) */}
                    {!isNew && (
                    <div className="grid gap-2">
                        <Label htmlFor="sku" className="flex items-center gap-2">
                            {t.editor.skuLabel}
                            <Lock className="h-3 w-3 text-muted-foreground" />
                        </Label>
                        <div className="rounded-md border border-input bg-muted px-3 py-2 text-sm cursor-not-allowed text-muted-foreground">
                            {form.watch('sku')}
                        </div>
                    </div>
                    )}
                    <div className="grid gap-2">
                        <Label htmlFor="location" className="flex items-center gap-2">
                            {t.editor.locationLabel}
                            {!isNew && <Lock className="h-3 w-3 text-muted-foreground" />}
                        </Label>
                        {isNew ? (
                            <Input id="location" {...form.register('location')} />
                        ) : (
                             <div className="rounded-md border border-input bg-muted px-3 py-2 text-sm cursor-not-allowed text-muted-foreground">
                                {form.watch('location')}
                            </div>
                        )}
                         {form.formState.errors.location && <p className="text-sm text-destructive">{form.formState.errors.location.message}</p>}
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="description" className="flex items-center gap-2">
                            {t.editor.descLabel}
                            {!isNew && <Lock className="h-3 w-3 text-muted-foreground" />}
                        </Label>
                        {isNew ? (
                            <Textarea id="description" {...form.register('description')} />
                        ) : (
                            <div
                                className="min-h-[100px] rounded-md border border-input bg-muted px-3 py-2 text-sm cursor-not-allowed"
                                dangerouslySetInnerHTML={{ __html: form.watch('description') || '' }}
                            />
                        )}
                         {form.formState.errors.description && <p className="text-sm text-destructive">{form.formState.errors.description.message}</p>}
                    </div>
                    {/* Image field - only show for existing courses */}
                    {!isNew && (
                     <div className="grid gap-2">
                        <Label htmlFor="image">{t.editor.imageLabel}</Label>
                        <div className="flex flex-col gap-4">
                             {form.watch('image') && (
                                <div className="relative aspect-video w-full overflow-hidden rounded-md border">
                                    <img src={form.watch('image')} alt="Preview" className="h-full w-full object-cover" />
                                </div>
                             )}
                            <div className="flex items-center gap-2 hidden">
                                <Input id="image-upload" type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled />
                                <Button type="button" variant="outline" onClick={() => document.getElementById('image-upload')?.click()} className="w-full" disabled>
                                    <Upload className="mr-2 h-4 w-4" />
                                    {form.watch('image') ? t.editor.changeImage : t.editor.uploadImage}
                                </Button>
                            </div>
                        </div>
                    </div>
                    )}
                </CardContent>
            </Card>
        </div>

        <div className="space-y-6">
            <Card className="h-full flex flex-col">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <div>
                        <CardTitle>{t.editor.inventory}</CardTitle>
                        <CardDescription>{t.editor.inventoryDesc}</CardDescription>
                    </div>
                    <Button
                        size="sm"
                        onClick={() => {
                            const nextDate = new Date();
                            nextDate.setDate(nextDate.getDate() + 2);
                            setNewDateForm({
                                dateTime: nextDate,
                                capacity: 10,
                                duration: 180,
                                price: course?.basePrice || 0,
                            });
                            setIsAddDateDialogOpen(true);
                        }}
                        variant="secondary"
                        disabled={isNew}
                    >
                        <Plus className="h-4 w-4 mr-1" /> {t.editor.addDate}
                    </Button>
                </CardHeader>
                <CardContent className="flex-1 overflow-auto">
                    {isNew ? (
                        <div className="flex items-center justify-center h-24 text-muted-foreground">
                            Save the course first to manage dates
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[180px]">{t.editor.dateHeader}</TableHead>
                                    <TableHead>{t.editor.timeHeader}</TableHead>
                                    <TableHead className="w-[100px]">{t.editor.durationHeader}</TableHead>
                                    <TableHead className="w-[90px]">{t.editor.capacityHeader}</TableHead>
                                    <TableHead className="w-[110px]">Price</TableHead>
                                    <TableHead className="w-[50px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {dates.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center text-muted-foreground h-24">
                                            {t.editor.noDates}
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    dates.map((date) => (
                                        <TableRow key={date.id}>
                                            <TableCell>
                                                <div className="flex items-center text-sm">
                                                    <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                                                    <span>{format(parseAsLocalTime(date.dateTime), "PPP")}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <span className="text-sm">{format(parseAsLocalTime(date.dateTime), 'HH:mm')}</span>
                                            </TableCell>
                                            <TableCell>
                                                <span className="text-sm">{date.duration || 0} min</span>
                                            </TableCell>
                                            <TableCell>
                                                {editingSeatsId === date.id ? (
                                                    <div className="flex items-center gap-1">
                                                        <Input
                                                            type="number"
                                                            min="1"
                                                            className="w-16 h-8 text-sm"
                                                            value={editedSeats}
                                                            onChange={(e) => setEditedSeats(parseInt(e.target.value) || 1)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    handleUpdateSeats(date.id, editedSeats);
                                                                } else if (e.key === 'Escape') {
                                                                    setEditingSeatsId(null);
                                                                }
                                                            }}
                                                            autoFocus
                                                        />
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="h-8 w-8"
                                                            onClick={() => handleUpdateSeats(date.id, editedSeats)}
                                                            disabled={updateSeatsMutation.isPending}
                                                        >
                                                            ✓
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <div
                                                        className="group flex items-center gap-1 cursor-pointer hover:bg-accent/50 rounded px-2 py-1 border border-transparent hover:border-muted-foreground/20 transition-all"
                                                        onClick={() => startEditingSeats(date.id, date.capacity)}
                                                    >
                                                        <span className="text-sm">{date.capacity}</span>
                                                        <Pencil className="h-3 w-3 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {editingPriceId === date.id ? (
                                                    <div className="flex items-center gap-1">
                                                        <Input
                                                            type="number"
                                                            step="0.01"
                                                            min="0"
                                                            className="w-20 h-8 text-sm"
                                                            value={editedPrice}
                                                            onChange={(e) => setEditedPrice(parseFloat(e.target.value) || 0)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    handleUpdatePrice(date.id, editedPrice);
                                                                } else if (e.key === 'Escape') {
                                                                    setEditingPriceId(null);
                                                                }
                                                            }}
                                                            autoFocus
                                                        />
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="h-8 w-8"
                                                            onClick={() => handleUpdatePrice(date.id, editedPrice)}
                                                            disabled={updateDateMutation.isPending}
                                                        >
                                                            ✓
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <div
                                                        className="group flex items-center gap-1 cursor-pointer hover:bg-accent/50 rounded px-2 py-1 border border-transparent hover:border-muted-foreground/20 transition-all"
                                                        onClick={() => startEditingPrice(date.id, date.price)}
                                                    >
                                                        <span className={`text-sm font-medium ${date.price !== course?.basePrice ? 'text-amber-600 dark:text-amber-400' : ''}`}>
                                                            €{Number(date.price).toFixed(2)}
                                                        </span>
                                                        {date.price !== course?.basePrice && (
                                                            <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded">
                                                                Custom
                                                            </span>
                                                        )}
                                                        <Pencil className="h-3 w-3 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleRemoveDate(date.id)}
                                                    disabled={deleteDateMutation.isPending}
                                                >
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
      </div>

      <Dialog open={isAddDateDialogOpen} onOpenChange={setIsAddDateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.editor.addDate}</DialogTitle>
            <DialogDescription>
              Add a new date for this course
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-2">
              <Label>{t.editor.dateHeader}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(newDateForm.dateTime, "PPP")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={newDateForm.dateTime}
                    onSelect={(d) => {
                      if (d) {
                        const current = newDateForm.dateTime;
                        d.setHours(current.getHours(), current.getMinutes(), 0, 0);
                        setNewDateForm({ ...newDateForm, dateTime: d });
                      }
                    }}
                    disabled={(date) => {
                        const min = new Date();
                        min.setDate(min.getDate() + 2);
                        min.setHours(0, 0, 0, 0);
                        return date < min;
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="grid gap-2">
              <Label>{t.editor.timeHeader}</Label>
              <Input
                type="time"
                value={format(newDateForm.dateTime, 'HH:mm')}
                onChange={(e) => {
                  const [hours, minutes] = e.target.value.split(':').map(Number);
                  const newDate = new Date(newDateForm.dateTime);
                  newDate.setHours(hours, minutes, 0, 0);
                  setNewDateForm({ ...newDateForm, dateTime: newDate });
                }}
              />
            </div>
            <div className="grid gap-2">
              <Label>{t.editor.capacityHeader}</Label>
              <Input
                type="number"
                min={1}
                value={newDateForm.capacity}
                onChange={(e) => setNewDateForm({ ...newDateForm, capacity: parseInt(e.target.value) || 1 })}
              />
            </div>
            <div className="grid gap-2">
              <Label>{t.editor.durationHeader} (min)</Label>
              <Input
                type="number"
                min={1}
                value={newDateForm.duration}
                onChange={(e) => setNewDateForm({ ...newDateForm, duration: parseInt(e.target.value) || 1 })}
              />
            </div>
            <div className="grid gap-2">
              <Label>Price (€)</Label>
              <Input
                type="number"
                step="0.01"
                min={0}
                value={newDateForm.price}
                onChange={(e) => setNewDateForm({ ...newDateForm, price: parseFloat(e.target.value) || 0 })}
              />
              <p className="text-xs text-muted-foreground">
                Default: €{Number(course?.basePrice).toFixed(2)} (base course price)
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDateDialogOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button onClick={handleAddDate} disabled={createDateMutation.isPending}>
              {createDateMutation.isPending ? t.editor.saving : t.editor.addDate}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
